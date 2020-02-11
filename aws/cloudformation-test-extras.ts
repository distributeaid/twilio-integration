import { stackName } from './stackName'
import { TwilioIntegrationTestExtrasApp } from './app/test-extras'

new TwilioIntegrationTestExtrasApp(stackName('test-extras')).synth()
