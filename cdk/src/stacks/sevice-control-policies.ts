// import path from 'path';
import { Arn, Fn, NestedStack, NestedStackProps } from 'aws-cdk-lib';
// import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';
import { AttachSCP } from '../constructs/attach-scp';

export class ServiceControlPoliciesStack extends NestedStack {
  constructor(scope: Construct, id: string, props: NestedStackProps) {
    super(scope, id, props);
    // new CfnInclude(this, 'SuperwerkerTemplate', {
    //   templateFile: path.join(__dirname, '..', '..', '..', 'templates', 'service-control-policies.yaml'),
    // });


    const securityHubPolicyStatement = {
      Condition: {
        ArnNotLike: {
          'aws:PrincipalARN': Arn.format({
            partition: this.partition,
            service: 'iam',
            region: '',
            account: '*',
            resource: 'role',
            resourceName: 'AWSControlTowerExecution',
          }),
        },
      },
      Action: [
        'securityhub:DeleteInvitations',
        'securityhub:DisableSecurityHub',
        'securityhub:DisassociateFromMasterAccount',
        'securityhub:DeleteMembers',
        'securityhub:DisassociateMembers',
      ],
      Resource: [
        '*',
      ],
      Effect: 'Deny',
      Sid: 'SWProtectSecurityHub',
    };

    const backupPolicyStatement = {
      Condition: {
        ArnNotLike: {
          'aws:PrincipalARN': Arn.format({
            partition: this.partition,
            service: 'iam',
            region: '',
            account: '*',
            resource: 'role',
            resourceName: 'stacksets-exec-*',
          }),
        },
      },
      Action: [
        'iam:AttachRolePolicy',
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:DeleteRolePermissionsBoundary',
        'iam:DeleteRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePermissionsBoundary',
        'iam:PutRolePolicy',
        'iam:UpdateAssumeRolePolicy',
        'iam:UpdateRole',
        'iam:UpdateRoleDescription',
      ],
      Resource: [
        Arn.format({
          partition: this.partition,
          service: 'iam',
          region: '',
          account: '*',
          resource: 'role',
          resourceName: 'service-role/AWSBackupDefaultServiceRole',
        }),
        Arn.format({
          partition: this.partition,
          service: 'iam',
          region: '',
          account: '*',
          resource: 'role',
          resourceName: 'SuperwerkerBackupTagsEnforcementRemediationRole',
        }),
      ],
      Effect: 'Deny',
      Sid: 'SWProtectBackup',
    };

    const policyStatements = Fn.join(
      ',',
      [
        Fn.conditionIf(
          'IncludeSecurityHub',
          securityHubPolicyStatement,
          Fn.ref('AWS::NoValue'),
        ).toString(),
        Fn.conditionIf(
          'IncludeBackup',
          backupPolicyStatement,
          Fn.ref('AWS::NoValue'),
        ).toString(),
      ],
    );

    new AttachSCP(this, 'SCPBaseline', {
      policy: Fn.sub(`{
              "Version": "2012-10-17",
              "Statement": [
                  \${Statements}
              ]
          }`, {
        Statements: policyStatements,
      }),
    });
  }
}