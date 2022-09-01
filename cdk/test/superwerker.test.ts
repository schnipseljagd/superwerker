import * as path from 'path';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Capture, Template } from 'aws-cdk-lib/assertions';
import { CfnInclude } from 'aws-cdk-lib/cloudformation-include';
import { Construct } from 'constructs';
import { SuperwerkerStack } from '../src/stacks/superwerker';

export class OriginalStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    new CfnInclude(this, 'SuperwerkerTemplate', {
      templateFile: path.join(__dirname, '..', '..', 'templates', 'superwerker.template.yaml'),
    });
  }
}

describe('parameters', () => {
  const app = new App();
  const originalStack = new OriginalStack(app, 'original', {});
  const stack = new SuperwerkerStack(app, 'stack', {});
  const expectedParameters = Template.fromStack(originalStack).toJSON().Parameters as { [key: string]: { [key: string]: string } };
  // Ignore the quickstart stuff for now
  for (const key in expectedParameters) {
    if (key.startsWith('QS')) delete expectedParameters[key];
  }
  test.each(Object.entries(expectedParameters))('parameter: %p', (param, value) => {
    Template.fromStack(stack).hasParameter(param, value);
  });
});

describe('resources', () => {
  const app = new App();
  const originalStack = new OriginalStack(app, 'original', {});
  const stack = new SuperwerkerStack(app, 'stack', {});
  const expectedResources = Template.fromStack(originalStack).toJSON().Resources as { [key: string]: { [key: string]: string } };
  // Ignore the original resources for generating an email
  for (const key in expectedResources) {
    if (key.startsWith('Generate')) delete expectedResources[key];
  }

  test.each(Object.entries(expectedResources))('resource: %p', (resource, resourceProps) => {
    // This sucks. Unfortunately we can't just call 'hasResource('myLogicalId').
    // TODO: make this better, either extend Template to have a better matcher or come up with a helper method.
    // Maybe like this: https://www.emgoto.com/jest-partial-match/
    // https://cdk-dev.slack.com/archives/C018XT6REKT/p1662017721195839
    // For now we just check that the logical id and the condition are the same

    if (resourceProps.Condition) {
      expect(Template.fromStack(stack).toJSON().Resources).toHaveProperty([resource, 'Condition'], resourceProps.Condition);
    } else {
      expect(Template.fromStack(stack).toJSON().Resources).toHaveProperty(resource);
    }
  });
});

describe('email generation', () => {
  const app = new App();
  const stack = new SuperwerkerStack(app, 'stack', {});
  const createCapture = new Capture();
  Template.fromStack(stack).hasResourceProperties('Custom::AWS', {
    Create: createCapture,
  });
  expect(JSON.stringify(createCapture.asObject())).toContain(SuperwerkerStack.AUDIT_ACCOUNT);
  createCapture.next();
  expect(JSON.stringify(createCapture.asObject())).toContain(SuperwerkerStack.LOG_ARCHIVE_ACCOUNT);
});
