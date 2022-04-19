'use strict';

angular.module('o19s.splainer-search')
  .service('transportSvc', [
    'HttpPostTransportFactory',
    'HttpGetTransportFactory',
    'HttpJsonPTransportFactory',
    'BulkTransportFactory',
    function transportSvc(
      HttpPostTransportFactory,
      HttpGetTransportFactory,
      HttpJsonPTransportFactory,
      BulkTransportFactory
    ) {
      var self = this;

      // functions
      self.getTransport = getTransport;

      var bulkTransport     = new BulkTransportFactory({});
      var httpPostTransport = new HttpPostTransportFactory({});
      var httpGetTransport  = new HttpGetTransportFactory({});
      var httpJsonPTransport  = new HttpJsonPTransportFactory({});

      function getTransport(options) {
        var apiMethod = options.apiMethod.toLowerCase();
        if (apiMethod === 'bulk') {
          return bulkTransport;
        } else if (apiMethod === 'jsonp') {
          return httpJsonPTransport;
        } else if (apiMethod === 'get') {
          return httpGetTransport;
        } else {
          return httpPostTransport;
        }
      }
    }
  ]);
