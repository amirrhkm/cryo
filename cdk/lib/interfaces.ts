import { Duration, StackProps, StageProps } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export interface IAccount {
    account: string;
    region: string;
}

export interface ITags {
    "silentmode:owner": string;
    "silentmode:service": string;
    "silentmode:environment": string;
}

export interface IProps {
    vpc: IVpcProps;
    resources: IResourceProps;
    lambda?: ILambdaProps;
    eventBridge?: IEventBridgeProps;
}

export interface IStageProps extends StageProps {
    props: IProps;
    deployTarget: IEnvironment;
    tags: ITags;
    appEnvs: any;
}

export interface IAppStackProps extends StackProps {
    props: IProps;
    deployTarget: IEnvironment;
    appEnvs: any;
}

export interface IResourceProps {
    ec2?: {
        instanceIds: string[];
    };
    rds?: {
        resources: Array<{
            identifier: string;
            type: 'cluster' | 'instance';
        }>;
    };
    ecs?: {
        clusters: Array<{
            clusterName: string;
            serviceNames: string[];
        }>;
    };
    rule?: {
        name: string[];
    };
    apiGw?: {
        api: Array<{
            domain: string;
            mapping: string;
        }>;
    };
}

export interface ILambdaProps {
    controller?: {
        runtime?: Runtime;
        timeout?: Duration;
        memorySize?: number;
    };
}

export interface IEventBridgeProps {
    rdsListener?: {
        enabled?: boolean;
    };
    autoDisable?: {
        enabled?: boolean;
    };
    completionCheck?: {
        intervalMinutes?: number;
        maxAttempts?: number;
    };
}

export interface IVpcProps {
    id: string;
    sg: string;
    region: string;
}

export type IEnvironment =
    | "shell-my-uat"
    | "ronpos-uat"
    | "bhp-uat";

