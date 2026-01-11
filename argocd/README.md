# Al-Ghazaly Auto Parts - ArgoCD GitOps Configuration

This directory contains ArgoCD configurations for GitOps-based continuous deployment.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GitOps Workflow                                    │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   GitHub     │───▶│   ArgoCD     │───▶│  Kubernetes  │───▶│  Running  │ │
│  │  Repository  │    │   Server     │    │   Cluster    │    │   Apps    │ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │
│         │                   │                                              │
│         │                   ▼                                              │
│         │           ┌──────────────┐                                       │
│         │           │   Sync &     │                                       │
│         └──────────▶│   Health     │                                       │
│                     │   Checks     │                                       │
│                     └──────────────┘                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
argocd/
├── install/
│   └── namespace.yaml       # ArgoCD namespace
├── projects/
│   └── alghazaly.yaml       # ArgoCD Project definition
├── applications/
│   ├── backend.yaml         # Backend Application
│   ├── frontend.yaml        # Frontend Application
│   └── app-of-apps.yaml     # App of Apps pattern
├── applicationsets/
│   └── environments.yaml    # Multi-environment deployment
└── README.md
```

## Quick Start

### 1. Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods to be ready
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
```

### 2. Access ArgoCD UI

```bash
# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Get initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Login via CLI
argocd login localhost:8080 --username admin --password <password>
```

### 3. Apply ArgoCD Configurations

```bash
# Apply project
kubectl apply -f argocd/projects/

# Apply applications
kubectl apply -f argocd/applications/

# Or use App of Apps pattern
kubectl apply -f argocd/applications/app-of-apps.yaml
```

## Features

- ✅ **Automated Sync**: Changes in Git automatically deployed
- ✅ **Self-Healing**: Drift detection and automatic correction
- ✅ **Multi-Environment**: Deploy to dev, staging, production
- ✅ **Rollback**: Easy rollback to any previous state
- ✅ **Health Checks**: Custom health assessments
- ✅ **Notifications**: Slack/Email alerts on sync status

## Sync Policies

| Environment | Auto-Sync | Self-Heal | Prune |
|-------------|-----------|-----------|-------|
| Development | ✅ Yes    | ✅ Yes    | ✅ Yes |
| Staging     | ✅ Yes    | ✅ Yes    | ❌ No  |
| Production  | ❌ No     | ❌ No     | ❌ No  |

## Troubleshooting

```bash
# Check application status
argocd app get alghazaly-backend

# Sync manually
argocd app sync alghazaly-backend

# View sync history
argocd app history alghazaly-backend

# Rollback
argocd app rollback alghazaly-backend <revision>
```
