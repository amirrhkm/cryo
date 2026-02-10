import { Construct } from "constructs";
import { Duration, aws_events as events, aws_events_targets as targets, aws_lambda as lambda } from "aws-cdk-lib";
import { IEnvironment } from "../../interfaces";

export interface CompletionCheckProps {
    environment: IEnvironment;
    controller: lambda.Function;
    checkIntervalMinutes?: number;
}

export class CompletionCheck extends Construct {
    public readonly completionCheckRule: events.Rule;

    constructor(scope: Construct, id: string, props: CompletionCheckProps) {
        super(scope, id);

        const intervalMinutes = props.checkIntervalMinutes || 5;

        this.completionCheckRule = new events.Rule(this, 'completion-check-rule', {
            ruleName: `cryo-${props.environment}-completion-check`,
            description: `Periodic check for Cryo ${props.environment} enable/disable completion`,
            schedule: events.Schedule.rate(Duration.minutes(intervalMinutes)),
            enabled: false,
        });

        this.completionCheckRule.addTarget(new targets.LambdaFunction(props.controller, {
            event: events.RuleTargetInput.fromObject({
                type: 'reconcile',
                source: 'completion-check',
            })
        }));
    }
}

