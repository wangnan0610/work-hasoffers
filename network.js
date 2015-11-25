var request = require('request').defaults({
    jar: true
  }),
  async = require('async'),
  urlUtil = require('url'),
  chalk = require('chalk'),
  cheerio = require('cheerio'),
  fs = require('fs'),
  _ = require('underscore');

/**
 * For example
 * config.loginUrl = 'https://xxx.hasoffers.com/'
 * config.deeplinkUrl = 'https://api-p03.hasoffers.com/v3/Affiliate_Offer.json'
 * config.configUrl = 'https://xxx.hasoffers.com/publisher/js/config.php'
 * config.email = 'xxxxx'
 * config.password = 'xxxxx'
 * config.infos = { 'lazada.co.id': {offer_id: xxx, currency: xxx, nation: id} }
 * config.testUrl = 'http://www.lazada.co.id/'
 * config.network = {name: xxx, aff_id: xxx}
 * config.tokenPath = 'xxx'
 * All Needed
 */
function Network(config) {
  this.config = config;
};

// Read token from file
Network.prototype.readToken = function() {
  var self = this;
  //存在
  if (fs.existsSync(self.config.tokenPath)) {
    return fs.readFileSync(self.config.tokenPath, 'utf8');
  }

  return null;
}

// Get Info from link
// offer_id, currency, nation
Network.prototype.getInfo = function(link) {
  var hostname = urlUtil.parse(link).hostname;
  var info = this.config.infos[hostname];

  return info;
}

// Test Token
Network.prototype.testToken = function(done) {
  var token = this.readToken();
  if (!token) {
    return console.log(chalk.red('--------- No Token, update Token'));
  }

  var info = this.getInfo(this.config.testUrl);
  if (!info) {
    return console.log(chalk.red('--------- No Info, check config'));
  }

  this.getDeeplink(this.config.testUrl, info['offer_id'], token, function(err, deeplink) {
    done(err, deeplink);
  })
};

// Get deeplink for link
Network.prototype.getDeeplink = function(link, offer_id, token, done) {
  var self = this;

  var form = {
    'offer_id': offer_id,
    'options[url]': link,
    'params[url]': link,
    'SessionToken': token,
    'options[tiny_url]': 1,
    'params[tiny_url]': 1,
    'Method': 'generateTrackingLink',
    'NetworkId': this.config.network.name,
    'affiliate_id': this.config.network['aff_id'],
  }

  console.log(form);

  request({
    url: self.config.deeplinkUrl,
    method: 'POST',
    form: form
  }, function(err, res, body) {
    var error = err;
    var deeplink;

    try {
      deeplink = JSON.parse(body).response.data['click_url'];
    } catch (e) {
      error = e;
    }

    done(error, deeplink);
  })
}

/**
 * Update Token
 * fn1.request loginUrl to get token_fields and token_key
 * fn2.post loginUrl to get cookie
 * fn3.request configUrl to get token
 */
Network.prototype.updateToken = function(done) {
  var self = this;

  function fn1(cb) {
    request(self.config.loginUrl, function(err, res, body) {
      var error = err;
      var token_fields, token_token;

      try {
        var $ = cheerio.load(body);
        token_key = $('input[name="data[_Token][key]"]').val();
        token_fields = $('input[name="data[_Token][fields]"]').val();
      } catch (e) {
        error = e;
      }
      cb(error, token_key, token_fields);
    })
  };

  function fn2(token_key, token_fields, cb) {
    var form = {
      '_method': 'POST',
      'data[User][email]': self.config.email,
      'data[User][password]': self.config.password,
      'data[_Token][fields]': token_fields,
      'data[_Token][key]': token_key
    };

    request({
      url: self.config.loginUrl,
      method: 'POST',
      form: form
    }, function(err, res, body) {
      cb(err);
    });
  };

  function fn3(cb) {
    request(self.config.configUrl, function(err, res, body) {
      var error = err;
      var token;
      try {
        var begin = body.indexOf('session_token');
        var end = body.indexOf('api_endpoint');
        token = body.slice(begin + 16, end - 3);
      } catch (e) {
        error = e;
      }

      cb(error, token);
    })
  };

  async.waterfall([

    function(callback) {
      fn1(callback);
    },
    function(token_key, token_fields, callback) {
      fn2(token_key, token_fields, callback);
    },
    function(callback) {
      fn3(callback);
    }
  ], function(err, token) {
    if (token) {
      fs.writeFileSync(self.config.tokenPath, token, 'utf8');
      console.log(chalk.green('---------- Update Token Success'))
    }
    done(err);
  })
}

// Crawler web
network.prototype.crawler = function(url, done) {
  request(url, function(err, res, body) {
    done(err, body);
  })
}

module.exports = Network;
