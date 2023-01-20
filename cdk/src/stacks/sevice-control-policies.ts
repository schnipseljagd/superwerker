import { Arn, CfnCondition, CfnParameter, Fn, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AttachSCP } from '../constructs/attach-scp';
import { EnableSCP } from '../constructs/enable-scp';

export class ServiceControlPoliciesStack extends NestedStack {
  constructor(scope: Construct, id: string, props: NestedStackProps) {
    super(scope, id, props);

    const includeSecurityHub = new CfnParameter(this, 'IncludeSecurityHub', {
      allowedValues: ['true', 'false'],
      type: 'String',
    });
    const includeSecurityHubCondition = new CfnCondition(this, 'IncludeSecurityHubCondition', {
      expression: Fn.conditionEquals(includeSecurityHub, 'true'),
    });

    const includeBackup = new CfnParameter(this, 'IncludeBackup', {
      allowedValues: ['true', 'false'],
      type: 'String',
    });
    const includeBackupCondition = new CfnCondition(this, 'IncludeBackupCondition', {
      expression: Fn.conditionEquals(includeBackup, 'true'),
    });

    const rolloutScpCondition = new CfnCondition(this, 'RolloutSCPs', {
      // TODO: should this be a conditionOr?
      expression: Fn.conditionAnd(
        Fn.conditionEquals(includeSecurityHubCondition, 'true'),
        Fn.conditionEquals(includeBackupCondition, 'true'),
      ),
    });

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
          'IncludeSecurityHubCondition',
          securityHubPolicyStatement,
          Fn.ref('AWS::NoValue'),
        ).toString(),
        Fn.conditionIf(
          'IncludeBackupCondition',
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
      condition: rolloutScpCondition,
    });

    new EnableSCP(this, 'SCPEnable');
  }
}
