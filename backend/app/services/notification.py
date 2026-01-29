"""
Enhanced Notification Service
Supports:
- Customer order notifications (localized)
- Global promotional notifications to all users
- Admin activity notifications (owner/partner/admin only)
"""
from datetime import datetime, timezone
import uuid
from typing import Optional, List
from ..core.database import db
from ..core.security import serialize_doc
from .websocket import manager


# Order status messages - localized
ORDER_STATUS_MESSAGES = {
    "pending": {
        "en": "Your order {order_number} has been received and is being processed",
        "ar": "تم استلام طلبك {order_number} وجاري معالجته",
        "type": "info"
    },
    "confirmed": {
        "en": "Your order {order_number} has been confirmed",
        "ar": "تم تأكيد طلبك {order_number}",
        "type": "info"
    },
    "preparing": {
        "en": "Your order {order_number} is being prepared",
        "ar": "جاري تحضير طلبك {order_number}",
        "type": "info"
    },
    "shipped": {
        "en": "Your order {order_number} has been shipped",
        "ar": "تم شحن طلبك {order_number}",
        "type": "info"
    },
    "out_for_delivery": {
        "en": "Your order {order_number} is out for delivery",
        "ar": "طلبك {order_number} في الطريق إليك",
        "type": "info"
    },
    "delivered": {
        "en": "Your order {order_number} has been successfully completed",
        "ar": "تم إكمال طلبك {order_number} بنجاح",
        "type": "success"
    },
    "completed": {
        "en": "Your order {order_number} has been successfully completed",
        "ar": "تم إكمال طلبك {order_number} بنجاح",
        "type": "success"
    },
    "cancelled": {
        "en": "Your order {order_number} has been cancelled",
        "ar": "تم إلغاء طلبك {order_number}",
        "type": "warning"
    }
}


async def create_notification(
    user_id: str, 
    title: str, 
    message: str, 
    notif_type: str = "info", 
    extra_data: dict = None
):
    """Create and broadcast a notification to a specific user"""
    notification = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "message": message,
        "type": notif_type,
        "read": False,
        "created_at": datetime.now(timezone.utc),
    }
    if extra_data:
        notification.update(extra_data)
    await db.notifications.insert_one(notification)
    await manager.send_notification(user_id, serialize_doc(notification))
    return notification


async def create_order_status_notification(
    user_id: str,
    order_number: str,
    status: str,
    order_id: str = None,
    language: str = "ar"
):
    """
    Send localized notification for order status changes.
    Automatically selects appropriate message and notification type based on status.
    """
    status_config = ORDER_STATUS_MESSAGES.get(status)
    if not status_config:
        # Fallback for unknown statuses
        status_config = {
            "en": f"Your order {order_number} status has been updated to {status.replace('_', ' ')}",
            "ar": f"تم تحديث حالة طلبك {order_number} إلى {status.replace('_', ' ')}",
            "type": "info"
        }
    
    # Get localized message
    message = status_config.get(language, status_config["en"]).format(order_number=order_number)
    
    # Generate localized title
    title_templates = {
        "delivered": {"en": "Order Delivered!", "ar": "تم التوصيل!"},
        "completed": {"en": "Order Completed!", "ar": "تم إكمال الطلب!"},
        "cancelled": {"en": "Order Cancelled", "ar": "تم إلغاء الطلب"},
        "shipped": {"en": "Order Shipped", "ar": "تم الشحن"},
        "preparing": {"en": "Order Being Prepared", "ar": "جاري التحضير"},
        "out_for_delivery": {"en": "Out for Delivery", "ar": "في الطريق"},
    }
    
    title_config = title_templates.get(status, {"en": "Order Update", "ar": "تحديث الطلب"})
    title = title_config.get(language, title_config["en"])
    
    extra_data = {
        "order_id": order_id,
        "order_number": order_number,
        "status": status,
        "notification_category": "order"
    }
    
    return await create_notification(
        user_id=user_id,
        title=title,
        message=message,
        notif_type=status_config["type"],
        extra_data=extra_data
    )


async def create_promotional_notification(
    title: str,
    title_ar: str,
    message: str,
    message_ar: str,
    image_url: Optional[str] = None,
    promotion_id: Optional[str] = None,
    bundle_id: Optional[str] = None,
    target_url: Optional[str] = None
):
    """
    Send promotional notification to ALL active users.
    Used for new promotions and bundle offers.
    """
    # Get all active users
    all_users = await db.users.find({"deleted_at": None}).to_list(10000)
    
    notifications_created = []
    
    for user in all_users:
        user_id = str(user.get("_id"))
        # Determine user's preferred language (default to Arabic)
        preferred_lang = user.get("preferred_language", "ar")
        
        localized_title = title_ar if preferred_lang == "ar" else title
        localized_message = message_ar if preferred_lang == "ar" else message
        
        extra_data = {
            "notification_category": "promotion",
            "image_url": image_url,
            "target_url": target_url
        }
        
        if promotion_id:
            extra_data["promotion_id"] = promotion_id
        if bundle_id:
            extra_data["bundle_id"] = bundle_id
        
        notification = await create_notification(
            user_id=user_id,
            title=localized_title,
            message=localized_message,
            notif_type="promo",
            extra_data=extra_data
        )
        notifications_created.append(notification)
    
    return notifications_created


async def create_admin_activity_notification(
    activity_type: str,
    activity_title_en: str,
    activity_title_ar: str,
    activity_message_en: str,
    activity_message_ar: str,
    extra_data: dict = None
):
    """
    Send notification to all users with admin roles (owner, partner, admin).
    Used for significant system activities like:
    - New user registration
    - Product changes
    - Order cancellations
    - Critical system events
    """
    # Get all admin users
    admin_roles = ["owner", "partner", "admin"]
    admin_users = await db.users.find({
        "role": {"$in": admin_roles},
        "deleted_at": None
    }).to_list(1000)
    
    notifications_created = []
    
    for user in admin_users:
        user_id = str(user.get("_id"))
        preferred_lang = user.get("preferred_language", "ar")
        
        localized_title = activity_title_ar if preferred_lang == "ar" else activity_title_en
        localized_message = activity_message_ar if preferred_lang == "ar" else activity_message_en
        
        notification_extra = {
            "notification_category": "admin_activity",
            "activity_type": activity_type
        }
        
        if extra_data:
            notification_extra.update(extra_data)
        
        notification = await create_notification(
            user_id=user_id,
            title=localized_title,
            message=localized_message,
            notif_type="admin",
            extra_data=notification_extra
        )
        notifications_created.append(notification)
    
    return notifications_created


# Convenience functions for specific admin activities
async def notify_admins_new_user(user_email: str, user_name: str = None):
    """Notify admins about new user registration"""
    display_name = user_name or user_email.split('@')[0]
    return await create_admin_activity_notification(
        activity_type="new_user",
        activity_title_en="New User Registered",
        activity_title_ar="تسجيل مستخدم جديد",
        activity_message_en=f"New user registered: {display_name}",
        activity_message_ar=f"تم تسجيل مستخدم جديد: {display_name}",
        extra_data={"user_email": user_email}
    )


async def notify_admins_product_change(
    product_name: str,
    product_id: str,
    action: str,  # 'created', 'updated', 'deleted'
    admin_name: str = None
):
    """Notify admins about product changes"""
    action_labels = {
        "created": {"en": "added", "ar": "إضافة"},
        "updated": {"en": "updated", "ar": "تحديث"},
        "deleted": {"en": "deleted", "ar": "حذف"}
    }
    
    action_en = action_labels.get(action, {"en": action})["en"]
    action_ar = action_labels.get(action, {"ar": action})["ar"]
    
    by_text_en = f" by {admin_name}" if admin_name else ""
    by_text_ar = f" بواسطة {admin_name}" if admin_name else ""
    
    return await create_admin_activity_notification(
        activity_type=f"product_{action}",
        activity_title_en=f"Product {action_en.title()}",
        activity_title_ar=f"تم {action_ar} منتج",
        activity_message_en=f"Product '{product_name}' was {action_en}{by_text_en}",
        activity_message_ar=f"تم {action_ar} المنتج '{product_name}'{by_text_ar}",
        extra_data={"product_id": product_id, "action": action}
    )


async def notify_admins_order_cancelled(
    order_number: str,
    order_id: str,
    customer_name: str = None,
    cancelled_by: str = "customer"  # 'customer' or 'admin'
):
    """Notify admins when an order is cancelled"""
    customer_text = f" by {customer_name}" if customer_name else ""
    customer_text_ar = f" من قبل {customer_name}" if customer_name else ""
    
    return await create_admin_activity_notification(
        activity_type="order_cancelled",
        activity_title_en="Order Cancelled",
        activity_title_ar="تم إلغاء طلب",
        activity_message_en=f"Order {order_number} was cancelled{customer_text}",
        activity_message_ar=f"تم إلغاء الطلب {order_number}{customer_text_ar}",
        extra_data={
            "order_id": order_id,
            "order_number": order_number,
            "cancelled_by": cancelled_by
        }
    )
