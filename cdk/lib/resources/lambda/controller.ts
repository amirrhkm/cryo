import { Construct } from "constructs";
import {
    Duration,
    Stack,
    aws_lambda as lambda,
    aws_iam as iam,
    aws_logs as logs
} from "aws-cdk-lib";
import {
    IEnvironment,
    IVpcProps,
    IResourceProps,
    IEventBridgeProps
} from "../../interfaces";
import * as path from "path";
import { SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";

export interface ControllerProps {
    vpc: IVpcProps;
    environment: IEnvironment;
    appEnvs: any;
    resources: IResourceProps;
    retryConfig: IEventBridgeProps;
    runtime?: lambda.Runtime;
    timeout?: Duration;
    memorySize?: number;
}

export class Controller extends Construct {
    public readonly function: lambda.Function;
    public readonly account: string;
    public readonly region: string;

    constructor(scope: Construct, id: string, props: ControllerProps) {
        super(scope, id);

        this.account = Stack.of(this).account;
        this.region = Stack.of(this).region;

        const vpc = Vpc.fromLookup(this, 'vpc', {
            vpcId: props.vpc.id,
        });

        const sg = new SecurityGroup(this, 'cryo-controller-sg', {
            vpc,
            allowAllOutbound: true,
        });

        const vpcSg = SecurityGroup.fromSecurityGroupId(this, 'vpc-sg', props.vpc.sg);

        const lambdaRole = this.createLambdaRole(props);
        this.function = this.createLambdaFunction(props, lambdaRole, vpc as Vpc, sg, vpcSg as SecurityGroup);
    }

    private createLambdaFunction(
        props: ControllerProps,
        role: iam.Role,
        vpc: Vpc,
        sg: SecurityGroup,
        vpcSg: SecurityGroup
    ): lambda.Function {
        return new lambda.Function(this, 'cryo-controller', {
            functionName: `cryo-controller-${props.environment}`,
            reservedConcurrentExecutions: 1,
            handler: 'index.handler',
            runtime: props.runtime || lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(path.join(__dirname, '../../../../app/dist')),
            role: role,
            timeout: props.timeout || Duration.minutes(15),
            memorySize: props.memorySize || 512,
            vpc,
            securityGroups: [sg, vpcSg],
            environment: this.buildEnvironmentVariables(props),
            logRetention: logs.RetentionDays.ONE_MONTH,
            description: `Cryo controller for ${props.environment}`,
        });
    }
    
    private buildEnvironmentVariables(props: ControllerProps): Record<string, string> {
        const ec2InstanceIds = props.resources.ec2?.instanceIds?.join(',') || '';
        const rdsResources = JSON.stringify(props.resources.rds?.resources || []);
        const ecsClusters = JSON.stringify(props.resources.ecs?.clusters || []);
        const ruleNames = props.resources.rule?.name?.join(',') || '';
        const apiGwNames = JSON.stringify(props.resources.apiGw?.api || []);
        const rdsClusterCount = props.resources.rds?.resources?.filter(r => r.type === 'cluster').length || 0;
        const rdsListenerRuleNames = Array.from({ length: rdsClusterCount }, (_, i) => 
            `cryo-${props.environment}-rds-${i}`
        ).join(',');
        const maxAttempts = props.retryConfig.completionCheck?.maxAttempts || 10;
        const delayMinutes = props.retryConfig.completionCheck?.intervalMinutes || 5;

        

        return {
            APP_ENV: props.environment,
            EC2_INSTANCE_IDS: ec2InstanceIds,
            RDS_RESOURCES: rdsResources,
            ECS_CLUSTERS: ecsClusters,
            RULE_NAMES: ruleNames,
            API_GW_NAMES: apiGwNames,
            RDS_LISTENER_RULE_NAMES: rdsListenerRuleNames,
            COMPLETION_CHECK_MAX_ATTEMPTS: maxAttempts.toString(),
            COMPLETION_CHECK_DELAY_MINUTES: delayMinutes.toString(),
            AUTO_DISABLE_RULE_NAME: `cryo-${props.environment}-auto-disable`,
            COMPLETION_CHECK_RULE_NAME: `cryo-${props.environment}-completion-check`,
            ...props.appEnvs,
        };
    }
    
    private createLambdaRole(props: ControllerProps): iam.Role {
        const role = new iam.Role(this, 'cryo-controller-role', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: `Cryo controller Lambda role for ${props.environment}`,
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });

        this.addEc2Permissions(role, props);
        this.addRdsPermissions(role, props);
        this.addEcsPermissions(role, props);
        this.addSsmPermissions(role, props);
        this.addSchedulerPermissions(role, props);
        this.addEventBridgePermissions(role, props);
        this.addApiGatewayPermissions(role, props);

        return role;
    }

    private addEc2Permissions(role: iam.Role, props: ControllerProps): void {
        if (props.resources.ec2?.instanceIds && props.resources.ec2.instanceIds.length > 0) {
            const instanceArns = props.resources.ec2.instanceIds.map(
                instanceId => `arn:aws:ec2:${this.region}:${this.account}:instance/${instanceId}`
            );

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ec2:StartInstances',
                        'ec2:StopInstances',
                    ],
                    resources: instanceArns,
                })
            );

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['ec2:DescribeInstances'],
                    resources: ['*'],
                })
            );
        }
    }

    private addRdsPermissions(role: iam.Role, props: ControllerProps): void {
        if (props.resources.rds?.resources && props.resources.rds.resources.length > 0) {
            const rdsArns = props.resources.rds.resources.map(resource => {
                if (resource.type === 'cluster') {
                    return `arn:aws:rds:${this.region}:${this.account}:cluster:${resource.identifier}`;
                } else {
                    return `arn:aws:rds:${this.region}:${this.account}:db:${resource.identifier}`;
                }
            });

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'rds:StartDBCluster',
                        'rds:StopDBCluster',
                        'rds:StartDBInstance',
                        'rds:StopDBInstance',
                    ],
                    resources: rdsArns,
                })
            );

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'rds:DescribeDBClusters',
                        'rds:DescribeDBInstances',
                    ],
                    resources: ['*'],
                })
            );
        }
    }

    private addEcsPermissions(role: iam.Role, props: ControllerProps): void {
        if (props.resources.ecs?.clusters && props.resources.ecs.clusters.length > 0) {
            const clusterArns: string[] = [];
            const serviceArns: string[] = [];

            props.resources.ecs.clusters.forEach(cluster => {
                clusterArns.push(`arn:aws:ecs:${this.region}:${this.account}:cluster/${cluster.clusterName}`);
                
                cluster.serviceNames.forEach(serviceName => {
                    serviceArns.push(`arn:aws:ecs:${this.region}:${this.account}:service/${cluster.clusterName}/${serviceName}`);
                });
            });

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'ecs:DescribeServices',
                        'ecs:UpdateService',
                    ],
                    resources: serviceArns,
                })
            );

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: ['ecs:ListServices'],
                    resources: clusterArns,
                })
            );
        }
    }

    private addSsmPermissions(role: iam.Role, props: ControllerProps): void {
        role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'ssm:GetParameter',
                    'ssm:PutParameter',
                ],
                resources: [
                    `arn:aws:ssm:${this.region}:${this.account}:parameter/cryo/*`,
                ],
            })
        );
    }

    private addSchedulerPermissions(role: iam.Role, props: ControllerProps): void {
        const rdsClusterCount = props.resources.rds?.resources?.filter(r => r.type === 'cluster').length || 0;
        const rdsListenerRuleArns = Array.from({ length: rdsClusterCount }, (_, i) => 
            `arn:aws:events:${this.region}:*:rule/cryo-${props.environment}-rds-${i}`
        );

        role.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    'events:PutRule',
                    'events:DescribeRule',
                    'events:EnableRule',
                    'events:DisableRule',
                ],
                resources: [
                    `arn:aws:events:${this.region}:*:rule/cryo-${props.environment}-auto-disable`,
                    `arn:aws:events:${this.region}:*:rule/cryo-${props.environment}-completion-check`,
                    ...rdsListenerRuleArns,
                ],
            })
        );
    }

    private addEventBridgePermissions(role: iam.Role, props: ControllerProps): void {
        if (props.resources.rule?.name && props.resources.rule.name.length > 0) {
            const ruleArns = props.resources.rule.name.map(
                (ruleName) => `arn:aws:events:${this.region}:*:rule/${ruleName}`
            );

            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'events:EnableRule',
                        'events:DisableRule',
                        'events:DescribeRule',
                    ],
                    resources: ruleArns,
                })
            );
        }
    }

    private addApiGatewayPermissions(role: iam.Role, props: ControllerProps): void {
        if (props.resources.apiGw?.api && props.resources.apiGw.api.length > 0) {
            role.addToPolicy(
                new iam.PolicyStatement({
                    effect: iam.Effect.ALLOW,
                    actions: [
                        'apigateway:GET',
                        'apigateway:POST',
                        'apigateway:DELETE',
                        'apigateway:PATCH',
                    ],
                    resources: [
                        `arn:aws:apigateway:${this.region}::/apis`,
                        `arn:aws:apigateway:${this.region}::/apis/*`,
                        `arn:aws:apigateway:${this.region}::/domainnames/*`,
                        `arn:aws:apigateway:${this.region}::/domainnames/*/apimappings`,
                        `arn:aws:apigateway:${this.region}::/domainnames/*/apimappings/*`,
                    ],
                })
            );
        }
    }
}

