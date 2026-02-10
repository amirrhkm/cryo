#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { executeStage, getProps, getTags, getAccount, getAppEnvs } from '../lib/utils';
import { IAccount, IEnvironment, IProps, ITags } from "../lib/interfaces";

async function app(): Promise<App> {
    const app = new App();
    const deployTarget: IEnvironment = app.node.tryGetContext("deploy_target");

    const account: IAccount = getAccount(deployTarget);
    const props: IProps = getProps(deployTarget);
    const tags: ITags = getTags(deployTarget);
    const appEnvs: any = getAppEnvs(process.env.ENV_FILE || `${deployTarget}.env`);
    
    executeStage(
        app,
        deployTarget,
        props,
        tags,
        account,
        appEnvs
    );

    return app;
}

app();

