#!/bin/bash
# Al-Ghazaly Auto Parts - ArgoCD Setup Script
# Run this script to set up ArgoCD in your Kubernetes cluster

set -e

echo "🚀 Setting up ArgoCD for Al-Ghazaly Auto Parts..."

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl is not installed. Please install it first."
    exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
fi

echo "✅ Kubernetes cluster is accessible"

# Create ArgoCD namespace
echo "📦 Creating ArgoCD namespace..."
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

# Install ArgoCD
echo "📦 Installing ArgoCD..."
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
echo "⏳ Waiting for ArgoCD pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Apply ArgoCD project
echo "📦 Applying ArgoCD project configuration..."
kubectl apply -f ../projects/

# Apply ArgoCD applications
echo "📦 Applying ArgoCD applications..."
kubectl apply -f ../applications/app-of-apps.yaml

# Get admin password
echo ""
echo "✅ ArgoCD installation complete!"
echo ""
echo "📋 ArgoCD Admin Credentials:"
echo "   Username: admin"
echo "   Password: $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)"
echo ""
echo "🌐 To access ArgoCD UI:"
echo "   kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo "   Then open: https://localhost:8080"
echo ""
echo "💡 To use ArgoCD CLI:"
echo "   argocd login localhost:8080 --username admin --password <password>"
echo ""
