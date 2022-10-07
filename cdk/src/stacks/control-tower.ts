import path from 'path';
import { CfnParameter, CfnWaitCondition, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { CfnWaitConditionHandle } from 'aws-cdk-lib/aws-cloudformation';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';
import { EnableControltower } from '../constructs/enable-controltower';

export class ControlTowerStack extends NestedStack {
  constructor(scope: Construct, id: string, props: NestedStackProps) {
    super(scope, id, props);
    new CfnInclude(this, 'SuperwerkerTemplate', {
      templateFile: path.join(__dirname, '..', '..', '..', 'templates', 'control-tower.yaml'),
    });


    const logArchiveAWSAccountEmail = new CfnParameter(this, 'LogArchiveAWSAccount', {
      type: 'String',
    });
    const auditAWSAccountEmail = new CfnParameter(this, 'AuditAWSAccount', {
      type: 'String',
    });


    new EnableControltower(this, 'EnableControltower', {
      logArchiveAwsAccountEmail: logArchiveAWSAccountEmail.valueAsString,
      auditAwsAccountEmail: auditAWSAccountEmail.valueAsString,
    });

    const controlTowerWaitHandle = new CfnWaitConditionHandle(this, 'ControlTowerReadyHandle');
    const controlTowerReadyHandleWaitCondition = new CfnWaitCondition(this, 'ControlTowerReadyHandleWaitCondition', {
      handle: controlTowerWaitHandle.ref,
      timeout: '7200',
    });

  }
}
