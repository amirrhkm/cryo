import { IProps } from "../../interfaces";
import { Duration } from "aws-cdk-lib";
import { Runtime } from "aws-cdk-lib/aws-lambda";

export const ShellMyUatProps: IProps = {
    vpc: {
        id: "vpc-05a99101163139cf6",
        sg: "sg-029aed0359fd7ab62",
        region: "ap-southeast-1"
    },
    resources: {
        ec2: {
            instanceIds: [
                "i-080ffe9277d82c492"
            ]
        },
        rds: {
            resources: [
                {
                    identifier: "hos-shell-uat-database-inventory6dbb118b-57nan42ibkje",
                    type: "cluster"
                },
                {
                    identifier: "hos-shell-uat-database-platform6d260a32-jjjcejysvea1-cluster",
                    type: "cluster"
                },
                {
                    identifier: "hos-shell-uat-database-tenant40c7f991-antfrtqutszs",
                    type: "cluster"
                },
                {
                    identifier: "hos-shell-uat-database-wetstock1291e052-f1vbzduecfkx",
                    type: "cluster"
                },
                {
                    identifier: "hos-shell-uat-pmr-database-dbecc37780-p08r0cueuhlk",
                    type: "cluster"
                },
                {
                    identifier: "tr-shell-uat-tr-postgres-dbecc37780-ps6yhpqb1tkc",
                    type: "cluster"
                },
                {
                    identifier: "local-account-shell-uat-rdspostgresqldbfbbe9899-b8tpwx2qlj3b",
                    type: "instance"
                }
            ]
        },
        ecs: {
            clusters: [
                {
                    clusterName: "hos-shell-uat-fg-cluster611F8AFF-833J9c5aFWDe",
                    serviceNames: [
                        "hos-shell-uat-fg-servicewebService24ACFC90-1OjzFQybBnds",
                        "hos-shell-uat-fg-serviceapiServiceF1074FD7-F5tSQHgdKhHy"
                    ]
                },
                {
                    clusterName: "hos-shell-uat-inventory-cluster",
                    serviceNames: [
                        "hos-shell-uat-inv-inventorywebService698B7E57-iugomkbTnfiR",
                        "hos-shell-uat-inv-awsqsserviceService578D1EF9-Shf8o6qSFp5P",
                        "hos-shell-uat-inv-awinventoryserviceServiceB7F4A617-ixn9JFZAuiVU"
                    ]
                },
                {
                    clusterName: "shell-uat-tr-cluster",
                    serviceNames: [ "tr-shell-uat-transaction-report-trwebServiceTrService9A0A9312-N6bNMNFNqdhM" ]
                },
                {
                    clusterName: "hub-rpc-gw-shell-uat",
                    serviceNames: [ "hub-rpc-gw-shell-uat-ECSService9DA5F7EF-EtjuxCGW9MKl" ]
                },
                {
                    clusterName: "hos-shell-uat-mqtt-clustermqtt00A22B88-No7o5WslfRbP",
                    serviceNames: [ "hos-shell-uat-mqtt-servicemqttService4A4C317B-mrgbx8QtxwSy" ]
                },
                {
                    clusterName: "wetstock-report-shell-uat",
                    serviceNames: [ "wetstock-report-shell-uat-ECSFgServiceA4A1BF35-Roy8L9yON7Sd" ]
                },
                {
                    clusterName: "local-account-shell-uat",
                    serviceNames: [ "local-account-shell-uat-ECSService9DA5F7EF-ifWFRJYeIqpz" ]
                },
                {
                    clusterName: "einvoice-app-shell-uat",
                    serviceNames: [
                        "einvoice-app",
                        "submission-worker"
                    ]
                },
                {
                    clusterName: "my-shell-uat-rp-cluster",
                    serviceNames: [ "my-shell-uat-rp-service" ]
                },
            ]
        },
        rule: {
            name: [
                "hos-shell-uat-gsap-job-pr-jobs3triggerEventsRuleED-6WN0N491V1ET",
                "hos-shell-uat-gsap-job-pr-scheduletriggerEventsRule-HvedV2pFBWGZ",
                "hos-shell-uat-inv-generateopeninginventorycost1174-9VTR4R3NIO2N",
                "hos-shell-uat-inv-generateopeninginventorycost2757-1XBFFHNJVDIPT",
                "hos-shell-uat-wetstock-RefreshDashbalanceDashcoldEv-iTukTa0cPPVe",
                "hos-shell-uat-wetstock-RefreshDashbalanceEventsRul-10RFBRZ5OCCON",
                "ronpos-shell-uat-fuel-updater-rule-1",
                "rsts-pmf-ho-uat-lambda-event-rule",
                "vmi-ho-lambda-event-rule"
            ]
        },
        apiGw: {
            api: [
                {
                    domain: "hubv2.uat.shell.ronpos.com",
                    mapping: "ronpos-hub-shell-uat-api"
                },
                {
                    domain: "mqttauth.uat.shell.ronpos.com",
                    mapping: "ronpos-mqtt-auth-shell-uat"
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