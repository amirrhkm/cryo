import { IProps } from "../../interfaces";
import { Duration } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export const ShellSgUatProps: IProps = {
    vpc: {
        id: "vpc-02bf1d426732d7280",
        sg: "sg-0b2cf16fe8a4cb0cd",
        region: "ap-southeast-1"
    },
    resources: {
        ec2: {
            instanceIds: [
                "i-0f86ee1bbc19cb0cc"
            ]
        },
        rds: {
            resources: [
                {
                    identifier: "tenant",
                    type: "cluster"
                },
                {
                    identifier: "platform",
                    type: "cluster"
                },
                {
                    identifier: "inventory",
                    type: "cluster"
                },
                {
                    identifier: "wetstock",
                    type: "cluster"
                },
                {
                    identifier: "pump-meter-reading",
                    type: "cluster"
                },
                {
                    identifier: "transaction-report",
                    type: "cluster"
                }
            ]
        },
        ecs: {
            clusters: [
                {
                    clusterName: "ronpos-uat-cloud-ecs-cluster",
                    serviceNames: [
                        "ronpos-uat-cloud-ecs-web-service",
                        "ronpos-uat-cloud-ecs-api-service"
                    ]
                },
                {
                    clusterName: "ronpos-uat-tr-cluster",
                    serviceNames: [ "ronpos-uat-tr-web-service" ]
                },
                {
                    clusterName: "ronpos-uat-inventory-ecs-cluster",
                    serviceNames: [ "ronpos-uat-inventory-web-service" ]
                },
                {
                    clusterName: "ronpos-uat-mqtt-ecs-cluster",
                    serviceNames: [ "ronpos-uat-mqtt-ecs-service" ]
                },
                {
                    clusterName: "ronpos-uat-hub-rpc-gw-ecs-cluster",
                    serviceNames: [ "ronpos-uat-hub-rpc-gw-api-service" ]
                },
                {
                    clusterName: "ronpos-uat-wetstock-report-ecs-cluster",
                    serviceNames: [ "ronpos-uat-wetstock-report" ]
                }
            ]
        },
        rule: {
            name: [
                "atg-ronpos-shell-sg-uat-infra-eventlistener6A003A62-Gcq1NIlp8Flo",
                "gm-ronpos-sg-uat-app-lambdasfileeventhandlerfiletri-A2cV1A4IkqXl",
                "hos-shell-sg-uat-gsap-job-jobs3triggerEventsRuleED7-Wx82QkhQkJ40",
                "gm-ronpos-sg-uat-app-lambdasscheduledeventhandlermo-5fsCqDr0rMSk",
                "hos-shell-sg-uat-gsap-job-scheduletriggerEventsRule-tUyMeGQCug6W",
                "sira-ronpos-shell-sg-uat-app-eventlistener6A003A62-G4B7rS3Y8bJE",
                "kpmg-shell-sg-uat-lambda-KpmgMonthlyRule93968FD8-RYfMgGbj2Csw",
                "kpmg-shell-sg-uat-lambda-KpmgDailyRuleD7EE8A31-DoUSaoXVUy4O",
                "ronpos-uat-inventory-generate-opening-stock-f5",
                "ronpos-shell-sg-uat-fuel-updater-rule-1",
                "rsts-pmf-ho-ronpos-uat-lambda-event-rule",
                "refresh-balance-cold-rule",
                "refresh-balance-rule",
                "vmi-ho-lambda-event-rule"
            ]
        },
        apiGw: {
            api: [
                {
                    domain: "hubv2.uat.shellsg.ronpos.com",
                    mapping: "ronpos-uat-hub-api"
                },
                {
                    domain: "mqttauth.uat.shellsg.ronpos.com",
                    mapping: "ronpos-uat-mqtt-auth-api"
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
            intervalMinutes: 5,
            maxAttempts: 10
        }
    }
};