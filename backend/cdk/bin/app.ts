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
  DB_USER: getEnvVarOrThrow("DB_USER"),
  DB_PASSWORD: getEnvVarOrThrow("DB_PASSWORD"),
  DB_HOST: getEnvVarOrThrow("DB_HOST"),
  DB_PORT: getEnvVarOrThrow("DB_PORT"),
  DB_NAME: getEnvVarOrThrow("DB_NAME"),
  BEARER_TOKEN: getEnvVarOrThrow("BEARER_TOKEN"),
  NEXT_PUBLIC_SUPABASE_URL: getEnvVarOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVarOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVarOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
  GROK_API_KEY: getEnvVarOrThrow("GROK_API_KEY"),
  GEMINI_API_KEY: getEnvVarOrThrow("GEMINI_API_KEY"),
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
