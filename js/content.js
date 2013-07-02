/*global $, jQuery, window, document, escape, unescape, alert, self, chrome, localStorage, setTimeout */

(function($){
  "use strict";

  $.fn.serializeJSON = function() {
    var json = {};

    $.map($(this).serializeArray(), function(n, i){
      json[n.name] = n.value;
    });
    return json;
  };

  $.extend($.expr[':'],{
    containsExactCase: function(a,i,m){
      return $.trim(a.innerHTML) === unescape(m[3]);
    }
  });

}(jQuery));

$(function() {

  "use strict";

  var ns = {
    n           : "namespotter",
    active      : false,
    tab         : {},
    config      : {},
    settings    : {},
    names       : {},
    highlights  : [],
    scrub       : ['select', 'input', 'textearea', 'script', 'style', 'noscript', 'img', 'iframe']
  };

  ns.compareStringLengths = function(a, b) {
    if (a.length < b.length) { return 1;  }
    if (a.length > b.length) { return -1; }
    return 0;
  };

  ns.highlight = function() {
    var self = this,
        verbatim = Object.keys(this.names).map(function(key) {
          return self.names[key];
        });
    
    verbatim = Array.prototype.concat.apply([], verbatim).sort(this.compareStringLengths);
    $('body').highlight(verbatim, { className : this.n+'-highlight', wordsOnly : true });
    this.highlights = $('span.'+this.n+'-highlight');
  };

  ns.unhighlight = function() {
    $('body').unhighlight({className: this.n+'-highlight'});
  };
  
  ns.toolTips = function() {
    var self = this;
    //Note: If tooltips from other sources, refactor into a method to return theme
    if((self.settings && self.settings.eol_tooltips && self.settings.eol_tooltips === 'true') || !self.settings.hasOwnProperty("eol_tooltips")) {
      self.highlights.css('cursor','pointer').tooltipster({
        content     : chrome.i18n.getMessage("loading"),
        theme       : '.tooltipster-shadow-eol',
        interactive : true,
        maxWidth    : 400,
        functionBefore : function(origin, continueTooltip) {
          continueTooltip();
          if(!self.similarTooltips(origin)) {
            $.ajax({
              type     : 'GET',
              dataType : 'JSON',
              url      : self.tooltipSearchURL(encodeURIComponent(self.getScientificName(origin.text()))),
              success: function(data) {
                if(data.totalResults > 0) {
                  self.getTooltipMedia(origin,data.results[0].id);
                } else {
                  self.noTooltipContent(origin);
                }
              },
              error: function() {
                return;
              }
            });
          }
        }
      });
    }
  };
  
  ns.getScientificName = function(name) {
    var scientificName = "";
    $.each(this.names, function(k, v) {
      if($.inArray(name, v) !== -1) { scientificName = k; return false; }
    });
    return scientificName;
  };
  
  ns.tooltipSearchURL = function(search_term) {
    //Note: If tooltips from other sources, refactor to pull URL from config
    return this.config.tooltips.eol.api_search.uri+this.config.tooltips.eol.api_search.params+search_term;
  };
  
  ns.similarTooltips = function(origin) {
    var self = this, name = origin.text(), occurrences = [], exists = false;

    occurrences = self.highlights.filter(":containsExactCase('"+escape(name)+"')");
    $.each(this.names, function(k, v) {
      if($.inArray(name, v) > -1 && k !== name) {
        occurrences = occurrences.add(self.highlights.filter(":containsExactCase('"+escape(k)+"')"));
        return false;
      }
    });

    $.each(occurrences, function() {
      if($(this).data('ajax') === 'cached') {
        origin.tooltipster('update',$(this).data('tooltipsterContent')).data('ajax', 'cached');
        exists = true;
        return false;
      }
    });
    return exists;
  };
  
  ns.getTooltipMedia = function(origin,id) {
    var self = this;
    $.ajax({
      type     : 'GET',
      dataType : 'JSON',
      url      : self.tooltipMediaURL(id),
      success: function(data) {
        origin.tooltipster('update',self.buildTooltipContent(data)).data('ajax', 'cached');
      },
      error: function() {
        return;
      }
    });
  };
  
  ns.tooltipMediaURL = function(id) {
    //Note: If tooltips from other sources, refactor to pull URL from config
    return this.config.tooltips.eol.api_pages.uri+id+".json"+this.config.tooltips.eol.api_pages.params;
  };
  
  ns.buildTooltipContent = function(data) {
    //Note: Refactor if tooltip from other sources
    var self = this,
        content = "", 
        vernacular = "",
        image = "", 
        text = "",
        link = this.config.tooltips.eol.pages+data.identifier,
        klass = "",
        lang = window.navigator.language.split("-")[0].toLowerCase();
    
    content += '<h2><a href="'+link+'" target="_blank">'+data.scientificName;
    $.each(data.vernacularNames, function() {
      if(this.language && lang === this.language) {
        vernacular = '<br><span>'+this.vernacularName+'</span>';
        return;
      }
    });
    content += vernacular+'</a></h2>';
    content += '<p class="tooltipster-eol">';
    $.each(data.dataObjects, function() {
      if(this.dataType && this.dataType === "http://purl.org/dc/dcmitype/StillImage") {
        image = '<a href="'+link+'" target="_blank"><img class="tooltipster-img" src="'+this.eolThumbnailURL+'" /></a>';
      } else if (this.dataType && this.dataType === "http://purl.org/dc/dcmitype/Text") {
        text = self.stripHTML(this.description);
        if(text.length > 400) { text = text.substring(0,400) + "&hellip;";}
      }
    });
    content += image + text;
    klass = (data.dataObjects.length > 0) ? 'tooltipster-eol-more' : 'tooltipster-eol-visit';
    content += '<span class="'+klass+'"><a href="'+link+'" target="_blank">';
    content += (data.dataObjects.length > 0) ? chrome.i18n.getMessage("more") : chrome.i18n.getMessage("visit_eol");
    content += '</a></span>';
    content += '</p>';
    return content;
  };
  
  ns.stripHTML = function(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText;
  };
  
  ns.noTooltipContent = function(origin) {
    origin.tooltipster('update', chrome.i18n.getMessage("nothing_found")).data('ajax', 'cached');
  };

  ns.i18n = function() {
    var self = this;

    $.each($("[data-"+self.n+"-i18n]"), function() {
      var message = chrome.i18n.getMessage($(this).attr("data-"+self.n+"-i18n"));
      $(this).html(message);
    });
  };

  ns.activateToolBox = function() {
    var self          = this,
        names_el      = $('#'+self.n+'-names').resizer(),
        names_el_list = $('#'+self.n+'-names-list'),
        maxZ          = Math.max.apply(null, $.map($('body *'), function(e,n) {
                          if($(e).css('position') === 'absolute') {
                            return parseInt($(e).css('z-index'),10) || 100000;
                          }
                        }));

    $('#'+self.n+'-toolbox').css('z-index', maxZ+1);

    $.each(['close', 'minimize', 'maximize'], function() {
      var item = this;
      $('#'+self.n+'-names-panel-actions').find('a.'+self.n+'-'+item).on('click', function(e) {
        e.preventDefault();
        if(item === 'minimize') { names_el.height('36px'); names_el_list.height('0px'); }
        if(item === 'maximize') { names_el.height('400px'); names_el_list.height('436px'); }
        if(item === 'close') {
          $('#'+self.n+'-toolbox').remove();
          self.unhighlight();
          chrome.extension.sendMessage({ method : "ns_closed", params : { tab : self.tab } });
        }
      });
    });

    if(!self.settings || !self.settings.engine) {
      $('#'+self.n+'-engine-both').prop('checked', true);
    }

    if(!self.settings || !self.settings.eol_tooltips) {
      $('#'+self.n+'-tooltips-eol').prop('checked', true);
    }

    if(!self.settings || !self.settings.detect_language) {
      $('#'+self.n+'-engine-language').prop('checked', true);
    }

    if(self.settings) {
      $.each(self.settings, function(name, value) {
        var ele = $('#'+self.n+'-settings-form').find('input[name="' + name + '"]');
        $.each(ele, function() {
          if(this.type === 'checkbox' || this.type === 'radio') {
            this.checked = (this.value === value);
          } else {
            this.value = value;
          }
        });
      });
    }
  };

  ns.makeToolBox = function() {
    var toolbox = "";

    $.ajax({
      type  : "GET",
      async : false,
      url   : chrome.extension.getURL('/toolbox.html'),
      success : function(data) {
        toolbox = data;
      }
    });

    $('body').append(toolbox);
    this.activateToolBox();
  };

  ns.showSettings = function() {
    $('#'+this.n+'-names-buttons').hide();
    $('#'+this.n+'-names-list').hide();
    $('#'+this.n+'-settings').show();
  };

  ns.hideSettings = function() {
    $('#'+this.n+'-names-buttons').show();
    $('#'+this.n+'-names-list').show();
    $('#'+this.n+'-settings').hide();
  };

  ns.saveSettings = function() {
    var self = this, message = { tab : self.tab, data : $('#'+this.n+'-settings-form').serializeJSON() };
    if(!$('#'+self.n+'-engine-language').prop("checked")) { message.data.detect_language = 'false'; }
    if(!$('#'+self.n+'-tooltips-eol').prop("checked")) { message.data.eol_tooltips = 'false'; }
    self.showMessage('saved');
    $.each(['-config', '-names-selections'], function(){
      $('#' + self.n + this).fadeOut(3000);
    });
    $('#'+self.n+'-settings').fadeOut(3000, function(){
      chrome.extension.sendMessage({ method : "ns_saveSettings", params : message });
    });
  };

  ns.buildNames = function(names) {
    var self = this;
    this.names = {};
    $.each(names, function() {
      if(self.names.hasOwnProperty(this.scientificName)) {
        self.names[this.scientificName].push(this.verbatim);
      } else {
        self.names[this.scientificName] = [this.verbatim];
      }
    });
  };

  ns.occurrences = function(string, subString, allowOverlapping){
    var n    = 0,
        pos  = 0,
        step = allowOverlapping ? 1 : subString.length;

    string += ""; subString += "";

    if(subString.length<=0) { return string.length+1; }

    while(true){
      pos = string.indexOf(subString, pos);
      if(pos >= 0) { n += 1; pos += step; } else { break; }
    }
    return n;
  };
  
  ns.unique = function(arr) {
    var hash = {}, result = [];
    for(var i = 0, l = arr.length; i < l; ++i) {
      if (!hash.hasOwnProperty(arr[i])) {
        hash[ arr[i] ] = true;
        result.push(arr[i]);
      }
    }
    return result;
  };

  ns.addNames = function() {
    var self        = this,
        key         = "",
        occurrences = "",
        list        = "",
        encoded     = "",
        markup      = "",
        options     = "";

    $.each(Object.keys(this.names).sort(), function() {
      key = this;
      occurrences = self.highlights.filter(":containsExactCase('"+escape(key)+"')");
      $.each(self.names[key], function() {
        if(this !== key) {
          occurrences = occurrences.add(self.highlights.filter(":containsExactCase('"+escape(this)+"')"));
        }
      });
      encoded = encodeURIComponent(key);
      list += '<li><input type="checkbox" id="ns-' + encoded + '" name="names[' + encoded + ']" value="' + this + '"><label for="ns-' + encoded + '">' + this + '</label></li>';
      markup = (occurrences.length > 1) ? " (" + occurrences.length + ")" : "";
      options += '<option value="' + this + '">' + this + markup + '</option>';
    });

    $('#' + self.n + '-names-list ul').html("").append(list);
    $('#' + self.n + '-names-selections select').append(options);
  };

  ns.showMessage = function(key) {
    var width = $('#' + this.n + '-toolbox').width()/2 - $('#' + this.n + '-message').width()/2 - 30;

    $('#' + this.n + '-message').text(chrome.i18n.getMessage(key)).css('left', width).slideDown('slow').delay(1000).slideUp('slow');
  };

  ns.activateButtons = function() {
    var self = this,
        data = {},
        names_panel = $('#'+self.n+'-names'),
        names_list_input = $('#'+self.n+'-names-list').find('input');

    $.each(['all', 'none', 'copy'], function() {
      var action = this;
      names_panel.on('click', 'a.' + self.n + '-select-' + action, function(e) {
        e.preventDefault();
        if(action === 'all') {
          $.each(names_list_input, function() {
            $(this).prop("checked", true);
          });
        }
        if(action === 'none') {
          $.each(names_list_input, function() {
            $(this).prop("checked", false);
          });
        }
        if(action === 'copy') {
          data = { names: $('#'+self.n+'-names-form').serializeArray() };
          chrome.extension.sendMessage({ method : "ns_clipBoard", params : data }, function(response) {
            if(response.message && response.message === "success") { self.showMessage('copied'); }
          });
        }
      });
    });

    $.each(['show', 'save', 'cancel'], function() {
      var action = this;
      names_panel.on('click', 'a.' + self.n + '-settings-' + action, function(e) {
        e.preventDefault();
        if(action === 'show') { self.showSettings(); }
        if(action === 'save') { self.saveSettings(); }
        if(action === 'cancel') { self.hideSettings(); }
      });
    });

  };

  ns.activateSelectList = function() {
    var self = this,
        arrows = $('#' + self.n + '-arrows');

    $('#' + self.n + '-names-selections').find('select').on('change', function() {
      var selected_val = $(this).find('option:selected').val(),
          current     = 0,
          occurrences = self.highlights.filter(":containsExactCase('" + escape(selected_val) + "')");

      $.each(self.names[selected_val], function() {
        if(selected_val !== this) {
          occurrences = occurrences.add(self.highlights.filter(":containsExactCase('" + escape(this) + "')"));
        }
      });

      self.highlights.removeClass(self.n + "-selected");
      self.scrollto(occurrences, current);
      
      arrows.off('click');

      $.each(['up', 'down'], function() {
        var inner_self = this;
        arrows.on('click', 'a.' + self.n + '-arrow-' + inner_self, function(e) {
          e.preventDefault();
          self.highlights.removeClass(self.n + "-selected");
          if($('#' + self.n + '-names-selections').find('select').val() === "") { return; }
          if(inner_self === 'up') {
            current -= 1;
            if(current < 0) { current = 0; }
          } else if (inner_self === 'down') {
            current += 1;
            if(current > occurrences.length - 1) { current = occurrences.length - 1; }
          }

          self.scrollto(occurrences, current);
        });
      });

    });

  };
  
  ns.scrollto = function(occurrences, index) {
    $('html, body').animate({ scrollTop: occurrences.eq(index).addClass(this.n + "-selected").offset().top-50 }, 500);
  };

  ns.analytics = function(category, action, label) {
    var data = { category : category, action : action, label : label };

    chrome.extension.sendMessage({ method : "ns_analytics", params : data });
  };

  ns.getParameterByName = function(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS  = "[\\?&]" + name + "=([^&#]*)",
        regex   = new RegExp(regexS),
        results = regex.exec(this.tab.url);

    if(results === null) { return ""; }
    return decodeURIComponent(results[1].replace(/\+/g, " "));
  };

  ns.sendComplete = function(total) {
    var message = { tab : this.tab, total : total || null };

    this.active = false;
    chrome.extension.sendMessage({ method : "ns_complete", params : message });
  };

  ns.sendPage = function() {
    var self    = this,
        engine  = (self.settings && self.settings.engine) ? self.settings.engine : null,
        lang    = (self.settings && self.settings.detect_language) ? self.settings.detect_language : 'true',
        url     = self.tab.url,
        message = { tab : self.tab, data : { unique : true, verbatim : false  } },
        ext     = url.split('.').pop().toLowerCase(),
        body    = "";

    self.active = true;

    if(url.indexOf("docs.google.com") !== -1 && ext === "pdf") {
      message.data.url = self.getParameterByName('url');
    } else if(ext === "pdf") {
      message.data.url = url;
    } else {
      body = $('body').clone();
      $.each(self.scrub, function() {
        $(body).find(this).remove();
      });
      $.each($(body).find('td'), function() {
        $(this).wrap("<span>&nbsp;</span>");
      });
      message.data.text  = body.text().replace(/\s+/g, " ");
    }

    if(engine) { message.data.engine = engine; }
    message.data.detect_language = lang;
    message.data.verbatim = 'true';

    $('#'+self.n+'-toolbox').remove();
    chrome.extension.sendMessage({ method : "ns_content", params : message });
  };

  ns.clearvars = function() {
    this.tab        = {};
    this.settings   = {};
    this.names = [];
  };

  ns.cleanup = function() {
    this.clearvars();
    this.unhighlight();
  };

  ns.showWarning = function() {
    var message = chrome.i18n.getMessage("content_warning");

    alert(message);
  };

  ns.unload = function() {
    var self = this;

    $(window).bind('beforeunload', function() {
      chrome.extension.sendMessage({ method : "ns_refresh", params : { tab : self.tab }}, function(response) {
        if(response.message === "success") {
          self.tab = {};
        }
      });
    });
  };

  ns.receiveMessages = function() {
    var self = this;

    chrome.extension.onMessage.addListener(function(request, sender, sendResponse) {
      switch(request.method) {
        case 'ns_initialize':
          self.cleanup();
          self.tab = request.params.tab;
          self.config = request.params.config;
          self.settings = request.params.settings;
          self.unload();
          try {
            if(self.active === false) { self.sendPage(); }
          } catch(e1) {
            self.sendComplete();
            self.showWarning();
          }
        break;

        case 'ns_names':
          if(request.params && request.params.total > 0 && self.tab.id !== undefined && $('#'+self.n+'-toolbox').length === 0) {
            try {
              self.buildNames(request.params.names);
              self.highlight();
              self.toolTips();
              self.makeToolBox();
              self.addNames();
              self.activateSelectList();
              self.activateButtons();
              self.i18n();
              self.sendComplete(request.params.total); //fix this because the total is wrong
            } catch(e2) {
              self.sendComplete();
              self.showWarning();
            }
          }
        break;
      }
      sendResponse({});
    });
  };

  ns.init = function() {
    this.receiveMessages();
  };

  ns.init();

});