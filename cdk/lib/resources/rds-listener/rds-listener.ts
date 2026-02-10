import { Construct } from "constructs";
import { aws_events as events, aws_events_targets as targets, aws_lambda as lambda, aws_iam as iam } from "aws-cdk-lib";
import { IEnvironment } from "../../interfaces";

export interface RdsListenerProps {
    environment: IEnvironment;
    controller: lambda.Function;
    rdsResources?: Array<{ identifier: string; type: 'cluster' | 'instance' }>;
}

export class RdsListener extends Construct {
    public readonly rdsListeners: events.Rule[];

    constructor(scope: Construct, id: string, props: RdsListenerProps) {
        super(scope, id);

        if (!props.rdsResources || props.rdsResources.length === 0) {
            this.rdsListeners = [];
            return;
        }

        const rdsClusterResources = props.rdsResources.filter(r => r.type === 'cluster');

        if (rdsClusterResources.length === 0) {
            this.rdsListeners = [];
            return;
        }

        // Create one EventBridge rule per RDS cluster
        this.rdsListeners = rdsClusterResources.map((resource, index) => 
            this.createRdsListenerForCluster(props, resource.identifier, index)
        );
    }

    private createRdsListenerForCluster(
        props: RdsListenerProps,
        clusterIdentifier: string,
        index: number
    ): events.Rule {
        // Create short, unique rule name using index (max 64 chars)
        const ruleName = `cryo-${props.environment}-rds-${index}`;

        const rule = new events.Rule(this, `rds-listener-${index}`, {
            ruleName: ruleName,
            description: `Detect auto-restart for RDS cluster ${clusterIdentifier}`,
            eventPattern: {
                source: ['aws.rds'],
                detailType: ['RDS DB Cluster Event'],
                detail: {
                    EventCategories: ['notification'],
                    Message: [
                        { prefix: 'DB cluster started' },
                        { prefix: 'Database cluster started' }
                    ],
                    SourceIdentifier: [clusterIdentifier] // Single cluster only
                }
            },
            enabled: true,
        });

        // Pass the specific cluster identifier to Lambda
        rule.addTarget(new targets.LambdaFunction(props.controller, {
            event: events.RuleTargetInput.fromObject({
                type: 'reconcile',
                source: 'rds-auto-restart',
                clusterIdentifier: clusterIdentifier, // Pass cluster ID to Lambda
            })
        }));

        return rule;
    }
}

