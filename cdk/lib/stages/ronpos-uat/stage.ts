import { Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { IStageProps } from "../../interfaces";
import { applyTags } from "../../utils";
import { AppStack } from "../../stacks/app.stack";

export class RonposUatStage extends Stage {
    constructor(scope: Construct, id: string, props: IStageProps) {
        super(scope, id, props);

        applyTags(this, props.tags);
        
        new AppStack(this, 'app', {
            deployTarget: props.deployTarget,
            props: props.props,
            appEnvs: props.appEnvs,
        });
    }
}

