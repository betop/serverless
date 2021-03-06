'use strict';

/**
 * EventDeploySNSLambda:
 *     Deploys an SNS based event sources. Subscribes a lambda to an SNS topic.
 *
 * Options:
 *     - stage: stage to deploy event to
 *     - region: region to deploy event to
 *     - path: event path
 */

module.exports = function(SPlugin, serverlessPath) {

  const path     = require('path'),
    SError       = require(path.join(serverlessPath, 'ServerlessError')),
    SUtils       = require(path.join(serverlessPath, 'utils/index')),
    BbPromise    = require('bluebird');


  class EventDeploySNSLambda extends SPlugin {

    constructor(S, config) {
      super(S, config);
    }

    static getName() {
      return 'serverless.core.' + EventDeploySNSLambda.name;
    }

    registerActions() {

      this.S.addAction(this.eventDeploySNSLambda.bind(this), {
        handler:       'eventDeploySNSLambda',
        description:   'Deploy an SNS event source. Subscribes the function to an SNS topic.'
      });

      return BbPromise.resolve();
    }

    /**
     * Event Deploy SNS Lambda
     */

    eventDeploySNSLambda(evt) {
      let _this     = this;
      _this.evt     = evt;

      if (!_this.evt.options.stage || !_this.evt.options.region || !_this.evt.options.path) {
        return BbPromise.reject(new SError(`Missing stage, region or path.`));
      }

      let event          = _this.S.state.getEvents({ paths: [_this.evt.options.path] })[0],
          populatedEvent = event.getPopulated({stage: _this.evt.options.stage, region: _this.evt.options.region}),
          awsAccountId   = _this.S.state.meta.get().stages[_this.evt.options.stage].regions[_this.evt.options.region].variables.iamRoleArnLambda.split('::')[1].split(':')[0],
          lambdaArn      = "arn:aws:lambda:" + _this.evt.options.region + ":" + awsAccountId + ":function:" + _this.S.state.getProject().name + "-" + _this.evt.options.path.split('/')[0] + "-" + _this.evt.options.path.split('/')[1] + "-" + _this.evt.options.path.split('/')[2].split('#')[0];

      let awsConfig  = {
        region:          _this.evt.options.region,
        accessKeyId:     _this.S.config.awsAdminKeyId,
        secretAccessKey: _this.S.config.awsAdminSecretKey
      };

      _this.SNS = require('../utils/aws/SNS')(awsConfig);

      let params = {
        Protocol: 'lambda',
        TopicArn: populatedEvent.config.topicArn,
        Endpoint: lambdaArn
      };

      return _this.SNS.subscribePromised(params)
        .then(function(data){

          SUtils.sDebug(`Subscription to SNS topic ${populatedEvent.config.topicArn} added for lambda ${lambdaArn}`);

          return BbPromise.resolve(data);
        });
    }
  }


  return( EventDeploySNSLambda );
};
