#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { NexusBackendStack } from "../lib/nexus-backend-stack";

const app = new cdk.App();

const version = process.env.VERSION || "latest";
const environment = process.env.ENVIRONMENT || "dev";

// Get environment variables
const envVars = {
  DATABASE_URL: getEnvVarOrThrow("DATABASE_URL"),
  SUPABASE_URL: getEnvVarOrThrow("SUPABASE_URL"),
  SUPABASE_KEY: getEnvVarOrThrow("SUPABASE_KEY"),
  TWITTER_CLIENT_ID: getEnvVarOrThrow("TWITTER_CLIENT_ID"),
  TWITTER_CLIENT_SECRET: getEnvVarOrThrow("TWITTER_CLIENT_SECRET"),
  OPENAI_API_KEY: getEnvVarOrThrow("OPENAI_API_KEY"),
  ANTHROPIC_API_KEY: getEnvVarOrThrow("ANTHROPIC_API_KEY"),
};

new NexusBackendStack(app, `nexus-backend-${environment}`, {
  version,
  environment,
  envVariables: envVars,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
});

function getEnvVarOrThrow(envVarName: string): string {
  const val = process.env[envVarName];
  if (val != null) {
    return val;
  }
  throw Error("Expected environment variable to be defined: " + envVarName);
}
