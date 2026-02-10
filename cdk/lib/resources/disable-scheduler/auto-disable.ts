import { Construct } from "constructs";
import { aws_events as events, aws_events_targets as targets, aws_lambda as lambda } from "aws-cdk-lib";
import { IEnvironment } from "../../interfaces";

export interface AutoDisableSchedulerProps {
    environment: IEnvironment;
    controller: lambda.Function;
}

export class AutoDisableScheduler extends Construct {
    public readonly disableRule: events.Rule;

    constructor(scope: Construct, id: string, props: AutoDisableSchedulerProps) {
        super(scope, id);

        this.disableRule = new events.Rule(this, 'disable-rule', {
            ruleName: `cryo-${props.environment}-auto-disable`,
            description: `Auto-disable rule for Cryo ${props.environment} environment`,
            schedule: events.Schedule.expression('cron(0 0 31 12 ? 2099)'),
            enabled: false,
        });

        this.disableRule.addTarget(new targets.LambdaFunction(props.controller, {
            event: events.RuleTargetInput.fromObject({
                type: 'disable'
            })
        }));
    }
}

