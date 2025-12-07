import { Stack, type StackProps, Duration } from "aws-cdk-lib";
import { Vpc, SecurityGroup, Peer, Port } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, LogDriver, FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import { ApplicationLoadBalancedFargateService } from "aws-cdk-lib/aws-ecs-patterns";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";

const CONTAINER_NAME = "nexus-backend";
const SERVICE_NAME = "nexus-backend";

export interface NexusEnvVariables {
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  [key: string]: string;
}

export interface NexusBackendStackProps extends StackProps {
  version: string;
  environment: string;
  envVariables: NexusEnvVariables;
}

export class NexusBackendStack extends Stack {
  constructor(scope: Construct, id: string, props: NexusBackendStackProps) {
    super(scope, id, props);

    const { version, environment, envVariables } = props;

    // Create VPC (or use existing)
    const vpc = new Vpc(this, "nexus-vpc", {
      maxAzs: 2,
      natGateways: 1,
    });

    // Security Group
    const securityGroup = new SecurityGroup(this, "nexus-sg", {
      securityGroupName: `nexus-backend-${environment}`,
      vpc,
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "HTTPS");
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "HTTP");

    // ECS Cluster
    const cluster = new Cluster(this, "nexus-cluster", {
      clusterName: `nexus-${environment}`,
      vpc,
    });

    // CloudWatch Log Group
    const logGroup = new LogGroup(this, "nexus-log-group", {
      logGroupName: `/ecs/nexus-backend-${environment}`,
      retention: RetentionDays.ONE_WEEK,
    });

    // Resource allocation based on environment
    const resources =
      environment === "prod"
        ? {
            cpu: 1024,
            memoryLimitMiB: 2048,
            desiredCount: 2,
          }
        : {
            cpu: 512,
            memoryLimitMiB: 1024,
            desiredCount: 1,
          };

    // Fargate Service
    const fargateService = new ApplicationLoadBalancedFargateService(
      this,
      SERVICE_NAME,
      {
        serviceName: SERVICE_NAME,
        cluster,
        ...resources,
        securityGroups: [securityGroup],
        taskImageOptions: {
          image: ContainerImage.fromTarball(`../nexus-backend:${version}.tar`),
          containerName: CONTAINER_NAME,
          containerPort: 8000,
          enableLogging: true,
          logDriver: LogDriver.awsLogs({
            logGroup,
            streamPrefix: SERVICE_NAME,
          }),
          environment: {
            ...envVariables,
            ENVIRONMENT: environment,
          },
        },
        assignPublicIp: true,
        publicLoadBalancer: true,
      }
    );

    // Health check
    fargateService.targetGroup.configureHealthCheck({
      path: "/health",
      healthyHttpCodes: "200,204",
      interval: Duration.seconds(30),
      timeout: Duration.seconds(5),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // Deregistration delay
    fargateService.targetGroup.setAttribute(
      "deregistration_delay.timeout_seconds",
      "30"
    );

    // Auto scaling
    const scaling = fargateService.service.autoScaleTaskCount({
      minCapacity: resources.desiredCount,
      maxCapacity: environment === "prod" ? 4 : 2,
    });

    scaling.scaleOnCpuUtilization("cpu-scaling", {
      targetUtilizationPercent: 70,
    });

    scaling.scaleOnMemoryUtilization("memory-scaling", {
      targetUtilizationPercent: 80,
    });
  }
}
