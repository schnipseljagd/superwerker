import * as path from 'path';
import * as pythonLambda from '@aws-cdk/aws-lambda-python-alpha';
import { aws_lambda as lambda, CustomResource, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface EnableControltowerProps {
  /**
   * Email of the audit aws account
   */
  readonly auditAwsAccountEmail: string;
  /**
   * Email of the log archive aws account
   */
  readonly logArchiveAwsAccountEmail: string;
}

export class EnableControltower extends Construct {
  constructor(scope: Construct, id: string, props: EnableControltowerProps) {
    super(scope, id);

    new CustomResource(this, 'Resource', {
      serviceToken: EnableControltowerProvider.getOrCreate(this),
      resourceType: 'Custom::EnableControltower',
      properties: {
        LOG_ARCHIVE_AWS_ACCOUNT_EMAIL: props.logArchiveAwsAccountEmail,
        AUDIT_AWS_ACCOUNT_EMAIL: props.auditAwsAccountEmail,
      },
    });
  }
}

class EnableControltowerProvider extends Construct {

  /**
   * Returns the singleton provider.
   */
  public static getOrCreate(scope: Construct) {
    const stack = Stack.of(scope);
    const id = 'superwerker.generate-email-address-provider';
    const x = stack.node.tryFindChild(id) as EnableControltowerProvider || new EnableControltowerProvider(stack, id);
    return x.provider.serviceToken;
  }

  private readonly provider: cr.Provider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const enableControltowerFn = new pythonLambda.PythonFunction(this, 'enable-controltower-on-event', {
      entry: path.join(__dirname, '..', 'functions', 'enable-controltower'),
      handler: 'handler',
      runtime: lambda.Runtime.PYTHON_3_9,
    });
    const awsapilibRole = new iam.Role(this, 'AwsApilibRole', {
      assumedBy: enableControltowerFn.role as iam.Role,
    });
    enableControltowerFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'sts:AssumeRole',
        ],
        resources: [
          awsapilibRole.roleArn,
        ],
      }),
    );

    enableControltowerFn.addEnvironment('AWSAPILIB_CONTROL_TOWER_ROLE_ARN', awsapilibRole.roleArn);

    this.provider = new cr.Provider(this, 'enable-controltower-provider', {
      onEventHandler: enableControltowerFn,
    });
  }
}
