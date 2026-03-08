import { App, Tags } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import { IAccount, IEnvironment, IProps, ITags } from "./interfaces";
import { ShellMyUatStage } from "./stages/shell-my-uat/stage";
import { ShellMyUatAccount } from "./stages/shell-my-uat/account";
import { ShellMyUatProps } from "./stages/shell-my-uat/props";
import { RonposUatStage } from "./stages/ronpos-uat/stage";
import { RonposUatAccount } from "./stages/ronpos-uat/account";
import { RonposUatProps } from "./stages/ronpos-uat/props";
import { BhpUatStage } from "./stages/bhp-uat/stage";
import { BhpUatAccount } from "./stages/bhp-uat/account";
import { BhpUatProps } from "./stages/bhp-uat/props";

export const executeStage = (
    app: App,
    deployTarget: IEnvironment,
    props: IProps,
    tags: ITags,
    account: IAccount,
    appEnvs: any
) => {
    switch (deployTarget) {
        case 'shell-my-uat':
            new ShellMyUatStage(app, `cryo-${deployTarget}`, {
                env: account,
                props: props,
                deployTarget: deployTarget,
                tags: tags,
                appEnvs: appEnvs
            });
            return;

        case 'ronpos-uat':
            new RonposUatStage(app, `cryo-${deployTarget}`, {
                env: account,
                props: props,
                deployTarget: deployTarget,
                tags: tags,
                appEnvs: appEnvs
            });
            return;

        case 'bhp-uat':
            new BhpUatStage(app, `cryo-${deployTarget}`, {
                env: account,
                props: props,
                deployTarget: deployTarget,
                tags: tags,
                appEnvs: appEnvs
            });
            return;

        default:
            throw new Error(
                `Unable to resolve CDK stage for the given deploy_target: ${deployTarget}`,
            );
    }
};

export const getAccount = (deployTarget: IEnvironment): IAccount => {
    switch (deployTarget) {
        case 'shell-my-uat':
            return ShellMyUatAccount;

        case 'ronpos-uat':
            return RonposUatAccount;

        case 'bhp-uat':
            return BhpUatAccount;

        default:
            throw new Error(
                `Unable to resolve AWS account for the given deploy_target: ${deployTarget}`,
            );
    }
};

export const getProps = (deployTarget: IEnvironment): IProps => {
    switch (deployTarget) {
        case 'shell-my-uat':
            return ShellMyUatProps;

        case 'ronpos-uat':
            return RonposUatProps;

        case 'bhp-uat':
            return BhpUatProps;

        default:
            throw new Error(
                `Unable to resolve CDK props for the given deploy_target: ${deployTarget}`,
            );
    }
};

export const getTags = (deployTarget: IEnvironment): ITags => {
    return {
        "silentmode:owner": "devops",
        "silentmode:service": "cryo",
        "silentmode:environment": deployTarget,
    };
};

export const getAppEnvs = (envFile: string): any => {
    if (!fs.existsSync(envFile)) {
        console.warn(`Environment file ${envFile} not found, using empty config`);
        return {};
    }
    return dotenv.parse(fs.readFileSync(envFile));
};

export const applyTags = (scope: Construct, tags: ITags) => {
    Object.entries(tags).forEach(([key, value]) => {
        Tags.of(scope).add(key, value);
    });
};

