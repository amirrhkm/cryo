import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IAppStackProps } from "../interfaces";
import { Controller } from "../resources/lambda/controller";
import { AutoDisableScheduler } from "../resources/disable-scheduler/auto-disable";
import { RdsListener } from "../resources/rds-listener/rds-listener";
import { CompletionCheck } from "../resources/completion-check/completion-check";

export class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: IAppStackProps) {
        super(scope, id, props);
        
        const controller = new Controller(this, 'controller', {
            vpc: props.props.vpc,
            environment: props.deployTarget,
            appEnvs: props.appEnvs,
            resources: props.props.resources,
            retryConfig: props.props.eventBridge || {},
            ...props.props.lambda?.controller,
        });

        if (props.props.eventBridge?.autoDisable?.enabled) {
            const scheduler = new AutoDisableScheduler(this, 'auto-disable-scheduler', {
                environment: props.deployTarget,
                controller: controller.function,
            });
        }

        if (props.props.eventBridge?.rdsListener?.enabled !== false) {
            const rdsListener = new RdsListener(this, 'rds-listener', {
                environment: props.deployTarget,
                controller: controller.function,
                rdsResources: props.props.resources.rds?.resources,
            });
        }

        const completionCheck = new CompletionCheck(this, 'completion-check', {
            environment: props.deployTarget,
            controller: controller.function,
            checkIntervalMinutes: props.props.eventBridge?.completionCheck?.intervalMinutes,
        });
    }
}

