# Production Deployment

## Prerequisites

- Kubernetes cluster (v1.24+)
- Helm 3.0+
- kubectl configured
- Access to container registry

## Quick Start

### Install

```bash
# Clone repository
git clone https://github.com/Blue-Kollar/Blue-Collar.git
cd Blue-Collar

# Install Helm chart
helm install blue-collar ./deploy/helm/blue-collar \
  --namespace blue-collar \
  --create-namespace \
  --values ./deploy/helm/blue-collar/values/production.yaml
helm upgrade blue-collar ./deploy/helm/blue-collar \
  --namespace blue-collar \
  --values ./deploy/helm/blue-collar/values/production.yaml
helm uninstall blue-collar --namespace blue-collar
helm install blue-collar ./deploy/helm/blue-collar \
  --values ./deploy/helm/blue-collar/values/development.yaml
helm install blue-collar ./deploy/helm/blue-collar \
  --values ./deploy/helm/blue-collar/values/staging.yaml
helm install blue-collar ./deploy/helm/blue-collar \
  --values ./deploy/helm/blue-collar/values/production.yaml
# Override specific values
helm install blue-collar ./deploy/helm/blue-collar \
  --set api.replicas=3 \
  --set api.resources.limits.memory=1Gi
kubectl create secret generic blue-collar-secrets \
  --namespace blue-collar \
  --from-literal=db-password=your-password \
  --from-literal=api-key=your-api-key
kubectl scale deployment blue-collar-api \
  --namespace blue-collar \
  --replicas=5
kubectl describe pod <pod-name> --namespace blue-collar
kubectl logs <pod-name> --namespace blue-collar
kubectl exec -it <db-pod> --namespace blue-collar -- psql -U blue_collar
kubectl get ingress --namespace blue-collar
kubectl describe ingress blue-collar --namespace blue-collar
kubectl exec -it <db-pod> --namespace blue-collar -- pg_dump -U blue_collar > backup.sql
kubectl exec -it <db-pod> --namespace blue-collar -- psql -U blue_collar < backup.sql
