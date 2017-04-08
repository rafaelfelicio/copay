'use strict';

angular.module('copayApp.controllers').controller('lockSetupController', function($state, $scope, $timeout, $log, configService, gettextCatalog, fingerprintService, profileService, lodash) {

  function init() {
    $scope.options = [
      {
        method: 'none',
        label: gettextCatalog.getString('Disabled'),
        disabled: false,
      },
      {
        method: 'pin',
        label: gettextCatalog.getString('Lock by PIN'),
        needsBackup: false,
        disabled: false,
      },
    ];

    if (fingerprintService.isAvailable()) {
      $scope.options.push({
        method: 'fingerprint',
        label: gettextCatalog.getString('Lock by Fingerprint'),
        needsBackup: false,
        disabled: false,
      });
    }

    initMethodSelector();
    processWallets();
  };

  $scope.$on("$ionicView.beforeEnter", function(event) {
    init();
  });

  function getSavedMethod() {
    var config = configService.getSync();
    if (config.lock) return config.lock.method;
    return 'none';
  };

  function initMethodSelector() {
    function disable(method) {
      lodash.find($scope.options, {
        method: method
      }).disabled = true;
    };

    var savedMethod = getSavedMethod();

    lodash.each($scope.options, function(o) {
      o.disabled = false;
    });

    // HACK: Disable untill we allow to change between methods directly
    if (fingerprintService.isAvailable()) {
      switch (savedMethod) {
        case 'pin':
          disable('fingerprint');
          break;
        case 'fingerprint':
          disable('pin');
          break;
      }
    }

    $scope.currentOption = lodash.find($scope.options, {
      method: savedMethod
    });
    $timeout(function() {
      $scope.$apply();
    });
  };

  function processWallets() {
    var wallets = profileService.getWallets();
    var singleLivenetWallet = wallets.length == 1 && wallets[0].network == 'dcrdlivenet' && wallets[0].needsBackup;
    var atLeastOneLivenetWallet = lodash.any(wallets, function(w) {
      return w.network == 'dcrdlivenet' && w.needsBackup;
    });

    if (singleLivenetWallet) {
      $scope.errorMsg = gettextCatalog.getString('Backup your wallet before using this function');
      disableOptsUntilBackup();
    } else if (atLeastOneLivenetWallet) {
      $scope.errorMsg = gettextCatalog.getString('Backup all livenet wallets before using this function');
      disableOptsUntilBackup();
    } else {
      enableOptsAfterBackup();
      $scope.errorMsg = null;
    }

    function enableOptsAfterBackup() {
      $scope.options[1].needsBackup = false;
      if ($scope.options[2]) $scope.options[2].needsBackup = false;
    };

    function disableOptsUntilBackup() {
      $scope.options[1].needsBackup = true;
      if ($scope.options[2]) $scope.options[2].needsBackup = true;
    };

    $timeout(function() {
      $scope.$apply();
    });
  };

  $scope.select = function(selectedMethod) {
    var savedMethod = getSavedMethod();
    if (savedMethod == selectedMethod) return;

    if (selectedMethod == 'none') {
      disableMethod(savedMethod);
    } else {
      enableMethod(selectedMethod);
    }
  };

  function disableMethod(method) {
    switch (method) {
      case 'pin':
        $state.transitionTo('tabs.pin', {
          action: 'disable'
        });
        break;
      case 'fingerprint':
        fingerprintService.check('unlockingApp', function(err) {
          if (err) init();
          else saveConfig('none');
        });
        break;
    }
  };

  function enableMethod(method) {
    switch (method) {
      case 'pin':
        $state.transitionTo('tabs.pin', {
          action: 'setup'
        });
        break;
      case 'fingerprint':
        saveConfig('fingerprint');
        break;
    }
  };

  function saveConfig(method) {
    var opts = {
      lock: {
        method: method,
        value: null,
      }
    };

    configService.set(opts, function(err) {
      if (err) $log.debug(err);
      initMethodSelector();
    });
  };
});