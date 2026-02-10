import { IProps } from "../../interfaces";
import { Duration } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export const BhpUatProps: IProps = {
    vpc: {
        id: "vpc-02f288e2192ad0fe8",
        sg: "sg-0cff77a87b0edd9c9",
        region: "ap-southeast-1"
    },
    resources: {
        ec2: {
            instanceIds: [
                "i-03a280818ba4dd92a"
            ]
        },
        rds: {
            resources: [
                {
                    identifier: "hos-bhp-uat-database-platform6d260a32-b2lqhw75zwxk",
                    type: "cluster"
                },
                {
                    identifier: "hos-bhp-uat-database-tenant40c7f991-j2ew3drwvnud",
                    type: "cluster"
                },
                {
                    identifier: "hos-bhp-uat-database-wetstock1291e052-fzsmdmfgmgh3",
                    type: "cluster"
                },
                {
                    identifier: "hos-bhp-uat-inv-database-hosbhpuatinvdatabase345b5-pdnby2n2jmrv",
                    type: "cluster"
                },
                {
                    identifier: "hos-bhp-uat-pmr-database-dbecc37780-togus3paxn1t",
                    type: "cluster"
                },
                {
                    identifier: "tr-bhp-uat-tr-postgres-dbecc37780-vgiygeekucur",
                    type: "cluster"
                },
                {
                    identifier: "local-account-bhp-uat-rdspostgresqldbfbbe9899-gq1hbwnghdwb",
                    type: "instance"
                }
            ]
        },
        ecs: {
            clusters: [
                {
                    clusterName: "hos-bhp-uat-fg-cluster611F8AFF-JBdOHZYnIoSt",
                    serviceNames: [
                        "hos-bhp-uat-fg-servicewebService24ACFC90-hVVHNYUtZQhT",
                        "hos-bhp-uat-fg-serviceapiServiceF1074FD7-byswd9QwDvCB"
                    ]
                },
                {
                    clusterName: "hos-bhp-uat-inventory-cluster",
                    serviceNames: [
                        "hos-bhp-uat-inv-awinventoryserviceServiceB7F4A617-vuyNZw0JW8rF",
                        "hos-bhp-uat-inv-awsqsserviceService578D1EF9-HSPTEC5jzRcp",
                        "hos-bhp-uat-inv-inventorywebService698B7E57-zylDo8CSw8U9"
                    ]
                },
                {
                    clusterName: "bhp-uat-tr-cluster",
                    serviceNames: [ "tr-bhp-uat-transaction-report-trwebServiceTrService9A0A9312-mJPzEh3Zir2a" ]
                },
                {
                    clusterName: "hub-rpc-gw-bhp-uat",
                    serviceNames: [ "hub-rpc-gw-bhp-uat-ECSService9DA5F7EF-klGBBSe3Pn25" ]
                },
                {
                    clusterName: "hos-bhp-uat-mqtt-clustermqtt00A22B88-Sby7Xf9FWKkn",
                    serviceNames: [ "hos-bhp-uat-mqtt-servicemqttService4A4C317B-JufCGQ551ehC" ]
                },
                {
                    clusterName: "wetstock-report-bhp-uat",
                    serviceNames: [ "wetstock-report-bhp-uat-ECSFgServiceA4A1BF35-hdX0KMFI9j3k" ]
                },
                {
                    clusterName: "local-account-bhp-uat",
                    serviceNames: [ "local-account-bhp-uat-ECSService9DA5F7EF-7YihzMxvIJ9V" ]
                },
                {
                    clusterName: "einvoice-app-bhp-uat",
                    serviceNames: [
                        "einvoice-app",
                        "submission-worker"
                    ]
                },
                {
                    clusterName: "my-bhp-uat-rp-cluster",
                    serviceNames: [ "my-bhp-uat-rp-service" ]
                },
                {
                    clusterName: "my-bhp-uat-dg-cluster",
                    serviceNames: [ "my-bhp-uat-dg-service" ]
                }
            ]
        },
        rule: {
            name: [
                "blue-yonder-uat-pmd-lambda-event-rule",
                "blue-yonder-uat-smd-lambda-event-rule",
                "blue-yonder-uat-spd-lambda-event-rule",
                "hos-bhp-uat-inv-generateopeninginventorycost1174DBC-lJ0Ph9GfWuhK",
                "hos-bhp-uat-inv-generateopeninginventorycost275776A-VqNrF1bSgbpF",
                "hos-bhp-uat-wetstock-RefreshDashbalanceDashcoldEven-Frrk4rHowFJu",
                "hos-bhp-uat-wetstock-RefreshDashbalanceEventsRuleS-6GSSEFZX7068"
            ]
        },
        apiGw: {
            api: [
                {
                    domain: "hubv2.uat.bhp.ronpos.com",
                    mapping: "ronpos-hub-bhp-uat-api"
                },
                {
                    domain: "mqttauth.uat.bhp.ronpos.com",
                    mapping: "ronpos-mqtt-auth-bhp-uat"
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