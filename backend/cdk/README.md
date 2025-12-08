# Nexus Backend CDK Deployment

This CDK stack deploys the Nexus FastAPI backend to AWS ECS Fargate.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured
3. **Node.js** 18+ and npm
4. **Docker** installed (for building container images)

## Setup

### 1. Install Dependencies

```bash
cd cdk
npm install
```

### 2. Configure AWS Credentials

Set up AWS CLI or configure GitHub Actions secrets:

```bash
aws configure
```

### 3. Set Environment Variables

Create a `.env` file or set these as GitHub Secrets:

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_KEY=...
TWITTER_CLIENT_ID=...
TWITTER_CLIENT_SECRET=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

### 4. Bootstrap CDK (First Time Only)

```bash
export AWS_ACCOUNT_ID=your-account-id
export AWS_REGION=us-east-1
cdk bootstrap aws://$AWS_ACCOUNT_ID/$AWS_REGION
```

## Deployment

### Manual Deployment

```bash
# Set environment variables
export VERSION=latest
export ENVIRONMENT=dev
export DATABASE_URL=...
# ... (set all required env vars)

# Synthesize CloudFormation template
cdk synth

# Deploy to AWS
cdk deploy --all
```

### GitHub Actions Deployment

The deployment happens automatically when you push to `main` branch.

#### Required GitHub Secrets:

1. `AWS_ROLE_ARN` - IAM role for GitHub Actions OIDC
2. `AWS_ACCOUNT_ID` - Your AWS account ID
3. `DATABASE_URL` - PostgreSQL connection string
4. `SUPABASE_URL` - Supabase project URL
5. `SUPABASE_KEY` - Supabase API key
6. `TWITTER_CLIENT_ID` - Twitter OAuth client ID
7. `TWITTER_CLIENT_SECRET` - Twitter OAuth secret
8. `OPENAI_API_KEY` - OpenAI API key
9. `ANTHROPIC_API_KEY` - Anthropic API key

## Architecture

The stack creates:

- **VPC** with public and private subnets
- **ECS Cluster** with Fargate tasks
- **Application Load Balancer** (ALB)
- **Security Groups** for network access
- **CloudWatch Log Group** for application logs
- **Auto Scaling** based on CPU and memory

## Resources Created

### Development Environment
- CPU: 512
- Memory: 1GB
- Desired count: 1 task
- Max tasks: 2

### Production Environment
- CPU: 1024
- Memory: 2GB
- Desired count: 2 tasks
- Max tasks: 4

## Useful Commands

```bash
# List all stacks
cdk list

# Synthesize CloudFormation template
cdk synth

# Deploy specific stack
cdk deploy nexus-backend-dev

# View stack differences
cdk diff

# Destroy stack (cleanup)
cdk destroy nexus-backend-dev
```

## Health Check

The service exposes a `/health` endpoint that the ALB uses for health checks.

## Monitoring

View logs in AWS CloudWatch:
```
Log Group: /ecs/nexus-backend-{environment}
```

## Cost Considerations

- **Fargate**: ~$30-50/month per task
- **ALB**: ~$20/month
- **NAT Gateway**: ~$30/month
- **Data Transfer**: Variable

**Estimated total**: $80-150/month for dev environment

## Troubleshooting

### Container fails to start
Check CloudWatch logs for errors:
```bash
aws logs tail /ecs/nexus-backend-dev --follow
```

### Health check failures
Ensure `/health` endpoint returns 200 status code

### Database connection issues
Verify DATABASE_URL is correct and database allows connections from ECS tasks

## Cleanup

To remove all resources:

```bash
cdk destroy --all
```

**Warning**: This will delete all data and resources created by the stack.
