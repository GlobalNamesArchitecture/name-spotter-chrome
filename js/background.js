/*global $, jQuery, window, document, self, chrome, localStorage, Image, alert */

var nsbg = nsbg || {},
    _gaq = _gaq || [];

$(function() {

  "use strict";

  nsbg.settings = {};
  nsbg.manifest = {};
  nsbg.config   = {};
  nsbg.total    = {};

  nsbg.animateIcon = function(tab) {
    var self    = this,
        img     = new Image(),
        c       = $('#canvas')[0].getContext('2d'),
        counter = 0;

    self.total[tab.id] = -1;

    window.setTimeout(function animate() {
      if(self.total[tab.id] === undefined) {
        self.setIcon(tab, 'default');
      } else if(self.total[tab.id] === 0) {
        self.setIcon(tab, 'gray');
      } else if (self.total[tab.id] > 0) {
        self.setIcon(tab, 'default');
      } else if (self.total[tab.id] === -1) {
        img.src = self.config.icons['19' + (counter % 4).toString()];
        img.onload = function() {
          c.clearRect(0, 0, 19, 15);
          c.drawImage(img, 0, 0, 19, 15);
          chrome.browserAction.setIcon({ imageData : c.getImageData(0, 0, 19, 15), tabId : tab.id });
        };
        counter += 1;
        window.setTimeout(animate, 125);
      }
    }, 125);
  };

  nsbg.loadSettings = function() {
    var storage = localStorage.namespotter || "";

    this.settings = $.parseJSON(storage);
  };

  nsbg.loadManifest = function() {
    var self = this, url = chrome.extension.getURL('/manifest.json');

    $.ajax({
      type  : "GET",
      async : false,
      url   : url,
      success : function(data) {
        self.manifest = $.parseJSON(data);
      }
    });

  };

  nsbg.loadConfig = function() {
    var self = this, url = chrome.extension.getURL('/config.json');

    $.ajax({
      type  : "GET",
      async : false,
      url   : url,
      success : function(data) {
        self.config = $.parseJSON(data);
      }
    });

  };

  nsbg.loadAnalytics = function() { 
   var ga = document.createElement('script'),
       s  = document.getElementsByTagName('script')[0];

   _gaq.push(['_setAccount', this.config.namespotter.ga]);
   _gaq.push(['_trackPageview']);
   ga.type = 'text/javascript';
   ga.async = true;
   ga.src = 'https://ssl.google-analytics.com/ga.js';
   s.parentNode.insertBefore(ga, s);
  };

  nsbg.analytics = function(category, action, label) {
    _gaq.push(['_trackPageview'], category, action, label);
  };

  nsbg.resetBadgeIcon = function(tab) {
    chrome.browserAction.setBadgeText({ text: "", tabId : tab.id });
    this.setIcon(tab, 'default');
    chrome.browserAction.setTitle({ title : chrome.i18n.getMessage("manifest_title") , tabId : tab.id });
  };

  nsbg.setBadge = function(tab, val, color) {
    var title = '';

    if(!color) { color = 'red'; }

    switch(color) {
      case 'red':
        color = [255, 0, 0, 175];
      break;

      case 'green':
        color = [0, 255, 0, 175];
      break;

      default:
        color = [255, 0, 0, 175];
    }
    chrome.browserAction.setBadgeText({ text: val, tabId : tab.id });
    chrome.browserAction.setBadgeBackgroundColor({ color : color, tabId : tab.id });

    if(val === '0') { title = chrome.i18n.getMessage("toolbox_no_names"); }
    chrome.browserAction.setTitle({ title : title, tabId : tab.id });
  };

  nsbg.setIcon = function(tab, type) {
    if(!type) { return; }

    var img = new Image(),
        c   = $('#canvas')[0].getContext('2d');

    img.src = (type === 'gray') ? this.config.icons.gray : this.config.icons['16'];
    img.onload = function() {
      c.clearRect(0, 0, 19, 15);
      c.drawImage(img, 0, 0, 19, 15);
      chrome.browserAction.setIcon({ imageData : c.getImageData(0, 0, 19, 15), tabId : tab.id });
    };
  };

  nsbg.sendMessage = function() {
    var self = this, data = {};

    chrome.tabs.query({active : true, currentWindow : true}, function(tab) {
      tab = tab[0];
      if(self.total[tab.id] !== undefined || self.total[tab.id] === -1) {
        delete self.total[tab.id];
      } else {
        self.analytics('initialize', 'get_url', tab.url);
        self.resetBadgeIcon(tab);
        self.animateIcon(tab);
        data = { url : tab.url, settings : self.settings, tab : tab };
        chrome.tabs.sendMessage(tab.id, { method : "ns_initialize", params : data });
      }
    });
  };

  nsbg.sendGNRDRequest = function(request, req_ws, req_type, req_data) {
    var self = this;

    $.ajax({
      type     : req_type,
      data     : req_data || "",
      dataType : 'json',
      url      : req_ws,
      success  : function(response) {
        if(response.status.toString() === "303") {
          window.setTimeout(function() {
            self.sendGNRDRequest(request, response.token_url, "GET");
          }, 1000);
        } else if (response.status.toString() === "200") {
          if(response.total > 0) {
            chrome.tabs.sendMessage(request.params.tab.id, { method : "ns_highlight", params : response });
          } else {
            self.total[request.params.tab.id] = 0;
            self.setBadge(request.params.tab, '0', 'red');
          }
        } else {
          self.total[request.params.tab.id] = 0;
          self.setBadge(request.params.tab, chrome.i18n.getMessage('failed'), 'red');
        }
      },
      error : function() {
        self.total[request.params.tab.id] = 0;
        self.setBadge(request.params.tab, chrome.i18n.getMessage('failed'), 'red');
      }
    });
  };

  nsbg.receiveMessages = function() {
    var self = this, names = [];

    chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
      var total    = "",
          category = request.params.category || "",
          action   = request.params.action || "",
          label    = request.params.label || "";

      sender = null;

      switch(request.method) {
        case 'ns_content':
          sendResponse({"message" : "success"});
          self.resetBadgeIcon(request.params.tab);
          self.sendGNRDRequest(request, self.config.namespotter.ws, "POST", request.params.data);
        break;

        case 'ns_complete':
          if(!request.params.total) {
            self.total[request.params.tab.id] = 0;
            self.setBadge(request.params.tab, total, 'red');
          } else {
            total = (request.params.total > 9999) ? ">999" : request.params.total.toString();
            self.total[request.params.tab.id] = request.params.total;
            self.setBadge(request.params.tab, total, 'green');
          }
        break;

        case 'ns_analytics':
          self.analytics(category, action, label);
          sendResponse({"message" : "success"});
        break;

        case 'ns_clipBoard':
          if(request.params.names.length > 0) {
            names = [];
            $.each(request.params.names, function() {
              names.push(this.value);
            });
            $('#namespotter-clipboard').val(names.join("\n"));
            $('#namespotter-clipboard')[0].select();
            document.execCommand("copy", false, null);
            sendResponse({"message" : "success"});
          } else {
            sendResponse({"message" : "failed"});
          }
        break;

        case 'ns_closed':
          self.resetBadgeIcon(request.params.tab);
          sendResponse({"message" : "success"});
        break;

        case 'ns_saveSettings':
          localStorage.removeItem("namespotter");
          localStorage.namespotter = JSON.stringify(request.params.data);
          delete self.total[request.params.tab.id];
          self.loadSettings();
          self.sendMessage();
          sendResponse({"message" : "success"});
        break;

        case 'ns_refresh':
          delete self.total[request.params.tab.id];
          self.resetBadgeIcon(request.params.tab);
          sendResponse({"message" : "success"});
        break;

        default:
          sendResponse({});
      }
    });
  };

  nsbg.cleanup = function() {
    this.settings = {};
  };

  nsbg.checkURL = function(url) {
    if(url.indexOf('https://chrome.google.com/') !== -1 ||
       url.indexOf('chrome://') !== -1 ||
       url.indexOf('about:') !== -1 ||
       url.indexOf('chrome-extension://') !== -1) {
      return true;
    }
    return false;
  };

  nsbg.addListener = function() {
    var self = this;

    chrome.browserAction.onClicked.addListener(function(tab) {
      if (self.checkURL(tab.url)) {
          alert(chrome.i18n.getMessage("content_security"));
          return;
      }
      self.cleanup();
      self.loadAnalytics();
      self.loadSettings();
      self.sendMessage();
    });
  };

  nsbg.init = function() {
    this.loadManifest();
    this.loadConfig();
    this.receiveMessages();
    this.addListener();
  };

  nsbg.init();

});