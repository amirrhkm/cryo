# Cryo - AWS Environment Cost-Control System

Cryo is an intelligent cost-control system that enables/disables entire cloud environments by managing AWS resources without deletion. It provides automated scheduling, state management, and reconciliation for EC2, RDS Aurora, ECS, EventBridge rules, and API Gateway custom domain mappings.

## 🎯 Features

- **Multi-Resource Management**: EC2, RDS, ECS, EventBridge Rules, API Gateway
- **Fire-and-Forget Operations**: Async operations with completion checks
- **Scheduled Auto-Disable**: Automatic environment shutdown after N days
- **RDS Auto-Restart Protection**: Prevents AWS 7-day auto-restart cost leakage
- **State-Based Reconciliation**: Controller-style reconciliation model
- **Dynamic Configuration**: Environment-specific retry and timing settings
- **Idempotent Operations**: Safe to run repeatedly without side effects

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Cryo Controller Lambda                         │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   EC2    │  │   RDS    │  │   ECS    │  │EventBrdg │  │  API GW  │   │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │              State Manager (SSM Parameter Store)                  │  │
│  │  - Environment State: /cryo/{env}/state                           │  │
│  │  - ECS Desired Counts: /cryo/ecs/{cluster}/{service}/desired_count│  │
│  │  - Completion Check Attempts: /cryo/completion-check-attempts     │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│  Auto-Disable     │   │ Completion Check  │   │  RDS Auto-Restart     │
│  EventBridge Rule │   │ EventBridge Rule  │   │  EventBridge Listener │
│  (Scheduled)      │   │  (Every 5 min)    │   │  (Event Pattern)      │
└───────────────────┘   └───────────────────┘   └───────────────────────┘
```

## 🔄 State Flow

```
                    ┌──────────┐
                    │ disabled │
                    └─────┬────┘
                          │
                   enable │
                          │
                    ┌─────▼────┐
              ┌────▶│ enabling │────┐
              │     └──────────┘    │
              │                     │ completion
              │                     │ check
    timeout   │                     │ (every 5 min)
              │                     │
              │     ┌──────────┐    │
              └─────│ enabled  │◀───┘
                    └─────┬────┘
                          │
                  disable │
                          │
                    ┌─────▼─────┐
              ┌────▶│ disabling │────┐
              │     └───────────┘    │
              │                      │ completion
              │                      │ check
    timeout   │                      │
              │                      │
              │     ┌──────────┐     │
              └─────│ disabled │◀────┘
                    └──────────┘
```

## 🏗️ Project Structure

```
cryo/
├── app/                          # Lambda application code
│   ├── src/
│   │   ├── api-gateway/          # API Gateway service
│   │   ├── config/               # Configuration management
│   │   ├── cryo-controller/      # Main controller
│   │   ├── ec2/                  # EC2 service
│   │   ├── ecs/                  # ECS service
│   │   ├── eventbridge/          # EventBridge rules service
│   │   ├── logger/               # Logging service
│   │   ├── rds/                  # RDS service
│   │   ├── scheduler/            # Scheduler service
│   │   └── state-manager/        # State management
│   └── package.json
├── cdk/                          # AWS CDK infrastructure
│   ├── lib/
│   │   ├── interfaces.ts         # TypeScript interfaces
│   │   ├── resources/            # CDK constructs
│   │   │   ├── completion-check/ # Completion check rule
│   │   │   ├── disable-scheduler/# Auto-disable scheduler
│   │   │   ├── lambda/           # Lambda function
│   │   │   └── rds-listener/     # RDS auto-restart listener
│   │   ├── stacks/               # CDK stacks
│   │   └── stages/               # Environment configs
│   │       ├── shell-my-uat/
│   │       ├── shell-sg-uat/
│   │       └── bhp-uat/
│   └── package.json
└── doc/                          # Documentation
```

## ⚙️ Configuration

Resources are configured per environment in `cdk/lib/stages/{env}/props.ts`:

```typescript
export const ShellMyUatProps: IProps = {
    vpc: {
        id: "vpc-xxx",
        sg: "sg-xxx",
        region: "ap-southeast-1"
    },
    resources: {
        ec2: {
            instanceIds: ["i-xxx", "i-yyy"]
        },
        rds: {
            resources: [
                { identifier: "aurora-cluster-1", type: "cluster" },
                { identifier: "postgres-instance-1", type: "instance" }
            ]
        },
        ecs: {
            clusters: [
                {
                    clusterName: "my-cluster",
                    serviceNames: ["api-service", "worker-service"]
                }
            ]
        },
        rule: {
            name: [
                "scheduled-job-rule-1",
                "scheduled-job-rule-2"
            ]
        },
        apiGw: {
            api: [
                {
                    domain: "api.example.com",
                    mapping: "my-api-gateway"
                }
            ]
        }
    },
    lambda: {
        controller: {
            runtime: Runtime.NODEJS_20_X,
            timeout: Duration.minutes(5),
            memorySize: 128
        }
    },
    eventBridge: {
        rdsListener: {
            enabled: true
        },
        autoDisable: {
            enabled: true
        },
        completionCheck: {
            intervalMinutes: 5,    // Check every 5 minutes
            maxAttempts: 10        // Max 10 attempts (50 min timeout)
        }
    }
};
```

## 🚀 Deployment

### Prerequisites

- Node.js 20.x
- AWS CLI configured with appropriate credentials
- AWS CDK 2.x installed globally: `npm install -g aws-cdk`

### Installation

```bash
# Install CDK dependencies
cd cdk
npm install

# Install app dependencies
cd ../app
npm install
```

### Build Application

```bash
cd app
npm run build
```

### Deploy to Environment

```bash
cd cdk

# Deploy to shell-my-uat
cdk deploy --all --profile your-aws-profile

# Or deploy specific stage
cdk deploy cryo-shell-my-uat --profile your-aws-profile
```

## 📖 Usage

### Enable Environment

Starts all resources and schedules auto-disable after N days:

```bash
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"enable","duration":"7"}' \
  response.json
```

**What happens:**
1. Sets state to `enabling`
2. Starts EC2 instances (async)
3. Starts RDS clusters/instances (async)
4. Restores ECS desired counts from saved state (async)
5. Enables EventBridge rules (async)
6. Creates API Gateway custom domain mappings (async)
7. Enables completion check (every 5 minutes)
8. Schedules auto-disable after 7 days
9. Waits for all resources to be ready
10. Sets state to `enabled` when complete

### Disable Environment

Stops all resources to save costs:

```bash
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"disable"}' \
  response.json
```

**What happens:**
1. Sets state to `disabling`
2. Scales ECS services to 0 (async)
3. Stops EC2 instances (async)
4. Stops RDS clusters/instances (async)
5. Disables EventBridge rules (async)
6. Removes API Gateway custom domain mappings (async)
7. Enables completion check (every 5 minutes)
8. Disables auto-disable scheduler
9. Waits for all resources to stop
10. Sets state to `disabled` when complete

### Save ECS Desired Counts

Manually save current ECS desired counts before first disable:

```bash
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"save"}' \
  response.json
```

### Reconcile Environment

Force reconciliation to desired state:

```bash
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"reconcile"}' \
  response.json
```

This checks the current state and ensures all resources match:
- If state is `enabled`: ensures all resources are running
- If state is `disabled`: ensures all resources are stopped

## 🔧 Resource Management

### EC2 Instances

- **Enable**: Starts instances using `StartInstances` API
- **Disable**: Stops instances using `StopInstances` API
- **Check**: Verifies instance state matches desired state

### RDS Clusters/Instances

- **Enable**: Starts clusters/instances using `StartDBCluster`/`StartDBInstance`
- **Disable**: Stops clusters/instances using `StopDBCluster`/`StopDBInstance`
- **Auto-Restart Protection**: EventBridge listener automatically stops RDS if AWS restarts after 7 days

### ECS Services

- **Enable**: Restores saved desired count using `UpdateService`
- **Disable**: Saves current desired count, then scales to 0
- **State Persistence**: Desired counts stored in SSM Parameter Store

### EventBridge Rules

- **Enable**: Enables rules using `EnableRule` API
- **Disable**: Disables rules using `DisableRule` API
- **Use Case**: Control scheduled jobs and cron tasks

### API Gateway Custom Domain Mappings

- **Enable**: Creates API mappings using `CreateApiMapping` API
- **Disable**: Removes API mappings using `DeleteApiMapping` API
- **Use Case**: Control API accessibility via custom domains

## 🛡️ RDS Auto-Restart Protection

AWS automatically restarts stopped RDS clusters after 7 days. Cryo prevents this cost leakage.

### How It Works

1. EventBridge rule listens for RDS cluster start events
2. Lambda is invoked with `{"type":"reconcile","source":"rds-auto-restart","clusterIdentifier":"..."}`
3. Checks environment state in Parameter Store
4. If state is `disabled`, stops the RDS cluster immediately
5. Handles transitional states gracefully

### Event Pattern

```json
{
  "source": ["aws.rds"],
  "detail-type": ["RDS DB Cluster Event"],
  "detail": {
    "EventCategories": ["notification"],
    "Message": [
      { "prefix": "DB cluster started" },
      { "prefix": "Database cluster started" }
    ],
    "SourceIdentifier": ["cluster-1", "cluster-2"]
  }
}
```

## 📊 State Management

### State Values

- `disabled`: Environment is stopped
- `disabling`: Environment is stopping (transitional)
- `enabled`: Environment is running
- `enabling`: Environment is starting (transitional)

### Storage Location

- **Environment State**: `/cryo/{env}/state`
- **ECS Desired Counts**: `/cryo/ecs/{cluster}/{service}/desired_count`
- **Completion Check Attempts**: `/cryo/completion-check-attempts`

### Check Current State

```bash
aws ssm get-parameter \
  --name /cryo/shell-my-uat/state \
  --query 'Parameter.Value' \
  --output text
```

## 🔍 Monitoring

### CloudWatch Logs

```bash
# Tail logs in real-time
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --follow

# View last hour
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --since 1h

# Filter for errors
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --since 1h --filter-pattern "ERROR"
```

### Check EventBridge Rules

```bash
# Auto-disable rule
aws events describe-rule --name cryo-shell-my-uat-auto-disable

# Completion check rule
aws events describe-rule --name cryo-shell-my-uat-completion-check

# RDS listener rules
aws events list-rules --name-prefix cryo-shell-my-uat-rds
```

### Metrics to Monitor

- Lambda invocations
- Lambda errors
- Lambda duration
- EventBridge rule invocations
- SSM Parameter Store API calls

## 🔐 IAM Permissions

The Lambda function requires the following permissions:

### EC2
- `ec2:DescribeInstances`
- `ec2:StartInstances`
- `ec2:StopInstances`

### RDS
- `rds:DescribeDBClusters`
- `rds:DescribeDBInstances`
- `rds:StartDBCluster`
- `rds:StopDBCluster`
- `rds:StartDBInstance`
- `rds:StopDBInstance`

### ECS
- `ecs:DescribeServices`
- `ecs:UpdateService`
- `ecs:ListServices`

### EventBridge
- `events:EnableRule`
- `events:DisableRule`
- `events:DescribeRule`
- `events:PutRule` (for scheduler)

### API Gateway
- `apigateway:GET`
- `apigateway:POST`
- `apigateway:DELETE`
- `apigateway:PATCH`

### SSM Parameter Store
- `ssm:GetParameter`
- `ssm:PutParameter`

## 🐛 Troubleshooting

### Resources Not Starting/Stopping

**Check CloudWatch Logs:**
```bash
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --since 30m
```

**Common Issues:**
- Wrong resource IDs in props.ts
- Missing IAM permissions
- Resources in transitional states
- Resources have dependencies (e.g., RDS in backup)

### RDS Auto-Restart Not Working

**Verify EventBridge Rule:**
```bash
aws events describe-rule --name cryo-shell-my-uat-rds-0
```

**Check Lambda Permissions:**
```bash
aws lambda get-policy --function-name cryo-controller-shell-my-uat
```

**View Invocation Logs:**
```bash
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --since 1h | grep "rds-auto-restart"
```

### Completion Check Timeout

If operations timeout after max attempts:

1. Check if resources are actually starting/stopping
2. Increase `maxAttempts` in eventBridge config
3. Increase `intervalMinutes` if resources need more time
4. Check for resource dependencies or locks

### API Gateway Mappings Not Working

**Verify Domain Exists:**
```bash
aws apigatewayv2 get-domain-name --domain-name api.example.com
```

**Check API ID:**
```bash
aws apigatewayv2 get-apis --query 'Items[?Name==`my-api`]'
```

## 📚 Best Practices

1. **Save ECS Counts**: Run `save` operation before first disable to preserve desired counts
2. **Monitor Logs**: Check CloudWatch Logs after each operation
3. **Enable RDS Protection**: Always enable `rdsListener` for RDS clusters
4. **Use Reconciliation**: Schedule daily reconciliation as a safety net
5. **Set Appropriate Timeouts**: Configure `completionCheck` based on resource startup times
6. **Document Resource IDs**: Keep props.ts well-documented with resource purposes
7. **Version Control**: Track all changes to props.ts in version control

## 🔄 Development Workflow

### Local Development

```bash
# Build app
cd app
npm run build

# Build CDK
cd ../cdk
npm run build

# Synthesize CloudFormation
cdk synth

# Check differences
cdk diff
```

### Testing Changes

```bash
# Deploy to UAT
cdk deploy cryo-shell-my-uat

# Test enable
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"enable","duration":"1"}' \
  response.json

# Check logs
aws logs tail /aws/lambda/cryo-controller-shell-my-uat --follow

# Test disable
aws lambda invoke \
  --function-name cryo-controller-shell-my-uat \
  --payload '{"type":"disable"}' \
  response.json
```