/**
 * @module gitty/repository
 */

var fs = require('fs');
var path = require('path');
var util = require('util');
var Command = require('./command');
var parse = require('./parser');
var events = require('events');
var logFmt = '--pretty=format:\'{"commit":"%H","author":"%an <%ae>",' +
    '"date":"%ad","message":"%s"},\'';

/**
 * Constructor function for all repository commands
 * @constructor
 * @param {string} repo
 */
var Repository = function(repo) {
    var self = this;

    events.EventEmitter.call(this);

    self.path = path.normalize(repo);
    self._ready = false;
    self.name = path.basename(self.path);

    fs.exists(self.path + '/.git', function(exists) {
        self.initialized = exists;
        self._ready = true;

        self.emit('ready');
    });
};

util.inherits(Repository, events.EventEmitter);

/**
 * Initializes the given directory as a GIT repository
 * #init
 * @param {array} flags
 * @param {function} callback
 */
Repository.prototype.init = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var flags = Array.isArray(args[0]) ? args[0] : [];
    var done = args.slice(-1).pop() || function() {};
    var cmd = new Command(self.path, 'init', flags, '');

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err || new Error(stderr));
        }

        self.initialized = true;

        done();
    });
};

/**
 * Initializes the given directory as a GIT repository
 * #initSync
 * @param {array} flags
 */
Repository.prototype.initSync = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var flags = Array.isArray(args[0]) ? args[0] : [];
    var cmd = new Command(self.path, 'init', flags, '');

    cmd.execSync();

    return self.initialized = true;
};

/**
 * Forwards the commit history to the callback function
 * #log
 * @param {string} path - optional branch or path
 * @param {function} callback
 */
Repository.prototype.log = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var path = typeof args[0] === 'string' ? args[0] : '';
    var done = args.slice(-1).pop() || function() {};
    var cmd = new Command(self.path, 'log', [logFmt, path]);

    cmd.exec(function(err, stdout, stderr) {
        if (err || stderr) {
            return done(err || new show(stderr));
        }

        done(null, parse.log(stdout));
    });
};

/**
 * Returns the commit history
 * #logSync
 * @param {string} branch
 */
Repository.prototype.logSync = function(branch) {
    var self = this;
    var cmd = new Command(self.path, 'log', [logFmt, branch || '']);

    return parse.log(cmd.execSync());
};

/**
 * Forwards the GIT status object to the callback function
 * #status
 * @param {function} callback
 */
Repository.prototype.status = function(callback) {
    var self = this;
    var done = callback || function() {};
    var status = new Command(self.path, 'status');
    var lsFiles = new Command(self.path, 'ls-files', ['-o', '--exclude-standard']);

    status.exec(function(err, status, stderr) {
        if (err) {
            return done(err);
        }

        lsFiles.exec(function(err, untracked, stderr) {
            if (err) {
                return done(err);
            }

            done(null, parse.status(status, untracked));
        });
    });
};

/**
 * Returns the GIT status object
 * #statusSync
 */
Repository.prototype.statusSync = function() {
    var self = this;
    var status = new Command(self.path, 'status');
    var lsFiles = new Command(self.path, 'ls-files', ['-o', '--exclude-standard']);

    return parse.status(status.execSync(), lsFiles.execSync());
};

/**
 * Stages the passed array of files for commiting
 * #add
 * @param {array} files
 * @param {function} callback
 */
Repository.prototype.add = function(files, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'add', [], files.join(' '));

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Stages the passed array of files for commiting
 * #addSync
 * @param {array} files
 */
Repository.prototype.addSync = function(files) {
    var self = this;
    var cmd = new Command(self.path, 'add', [], files.join(' '));

    return cmd.execSync();
};

/**
 * Removes the passed array of files from the repo for commiting
 * #remove
 * @param {array} files
 * @param {function} callback
 */
Repository.prototype.remove = function(files, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'rm', ['--cached'], files.join(' '));

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            done(err);
        }

        done(null);
    });
};

/**
 * Removes the passed array of files from the repo for commiting
 * #removeSync
 * @param {array} files
 */
Repository.prototype.removeSync = function(files) {
    var self = this;
    var cmd = new Command(self.path, 'rm', ['--cached'], files.join(' '));

    return cmd.execSync();
};

/**
 * Unstages the passed array of files from the staging area
 * #unstage
 * @param {array} files
 * @param {function} callback
 */
Repository.prototype.unstage = function(files, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'reset HEAD', [], files.join(' '));

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Unstages the passed array of files from the staging area
 * #unstageSync
 * @param {array} files
 */
Repository.prototype.unstageSync = function(files) {
    var self = this;
    var cmd = new Command(self.path, 'reset HEAD', [], files.join(' '));

    return cmd.execSync();
};

/**
 * Commits the staged area with the given message
 * #commit
 * @param {string} message
 * @param {function} callback
 */
Repository.prototype.commit = function(message, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(this.path, 'commit', ['-m'], '"' + message + '"');

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        var result = stdout ? parse.commit(stdout) : {};

        if (result.error) {
            return done(result.error);
        }

        done(null, result);
    });
};

/**
 * Commits the staged area with the given message
 * #commitSync
 * @param {string} message
 */
Repository.prototype.commitSync = function(message) {
    var self = this;
    var cmd = new Command(this.path, 'commit', ['-m'], '"' + message + '"');
    var output = cmd.execSync();
    var result = output ? parse.commit(output) : {};

    if (result.error) {
        throw new Error(result.error);
    }

    return result;
};

/**
 * Forwards object with the branch and all others to the callback
 * #getBranches
 * @param {string} flags
 * @param {function} callback
 */
Repository.prototype.getBranches = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var flags = Array.isArray(args[0]) ? args[0] : null;
    var done = args.slice(-1).pop();
    var cmd = new Command(self.path, 'branch', flags);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null, parse.branch(stdout));
    });
};

/**
 * Returns a denoted object with the current branch and all other branches
 * #getBranchesSync
 * @param {function} callback
 */
Repository.prototype.getBranchesSync = function() {
    var self = this;
    var cmd = new Command(self.path, 'branch');

    return parse.branch(cmd.execSync());
};

/**
 * Creates a new branch with the given branch name
 * #createBranch
 * @param {string} name
 * @param {function} callback
 */
Repository.prototype.createBranch = function(name, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'branch', [], name);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Creates a new branch with the given branch name
 * #createBranchSync
 * @param {string} name
 */
Repository.prototype.createBranchSync = function(name) {
    var self = this;
    var cmd = new Command(self.path, 'branch', [], name);

    return cmd.execSync();
};

/**
 * Performs a GIT checkout on the given branch
 * #checkout
 * @param {string} branch
 * @param {string} flags
 * @param {function} callback
 */
Repository.prototype.checkout = function(branch, flags, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'checkout', flags, branch);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        self.getBranches(done);
    });
};

/**
 * Performs a GIT checkout on the given branch
 * #checkoutSync
 * @param {string} branch
 */
Repository.prototype.checkoutSync = function(branch) {
    var self = this;
    var cmd = new Command(self.path, 'checkout', [], branch);

    cmd.execSync();

    return self.getBranchesSync();
};

/**
 * Performs a GIT merge in the current branch against the specified one
 * #merge
 * @param {string} branch
 * @param {function} callback
 */
Repository.prototype.merge = function(branch, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'merge', [], branch);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Performs a GIT merge in the current branch against the specified one
 * #mergeSync
 * @param {string} branch
 */
Repository.prototype.mergeSync = function(branch) {
    var self = this;
    var cmd = new Command(self.path, 'merge', [], branch);

    return cmd.execSync();
};

/**
 * Forwards a array of repositorys'tags to the callback function
 * #getTags
 * @param {function} callback
 */
Repository.prototype.getTags = function(callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'tag');

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null, parse.tag(stdout));
    });
};

/**
 * Forwards a array of repositorys'tags to the callback function
 * #getTagsSync
 */
Repository.prototype.getTagsSync = function() {
    var self = this;
    var cmd = new Command(self.path, 'tag');

    return parse.tag(cmd.execSync());
};

/**
 * Creates a new tag from the given tag name
 * #createTag
 * @param {string} name
 * @param {function} callback
 */
Repository.prototype.createTag = function(name, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'tag', [], name);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Creates a new tag from the given tag name
 * #createTagSync
 * @param {string} name
 */
Repository.prototype.createTagSync = function(name) {
    var self = this;
    var cmd = new Command(self.path, 'tag', [], name);

    return cmd.execSync();
};

/**
 * Adds a new remote
 * #addRemote
 * @param {string} remote
 * @param {string} url
 * @param {function} callback
 */
Repository.prototype.addRemote = function(remote, url, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'remote add', [], remote + ' ' + url);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Adds a new remote
 * #addRemoteSync
 * @param {string} remote
 * @param {string} url
 */
Repository.prototype.addRemoteSync = function(remote, url) {
    var self = this;
    var cmd = new Command(self.path, 'remote add', [], remote + ' ' + url);

    return cmd.execSync();
};

/**
 * Changes the URL of a existing remote
 * #setRemoteUrl
 * @param {string} remote
 * @param {string} url
 * @param {function} callback
 */
Repository.prototype.setRemoteUrl = function(remote, url, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'remote set-url', [], remote + ' ' + url);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Changes the URL of a existing remote
 * #setRemoteUrlSync
 * @param {string} remote
 * @param {string} url
 * @param {function} callback
 */
Repository.prototype.setRemoteUrlSync = function(remote, url) {
    var self = this;
    var cmd = new Command(self.path, 'remote set-url', [], remote + ' ' + url);

    return cmd.execSync();
};

/**
 * Removes the given remote
 * #removeRemote
 * @param {string} remote
 * @param {function} callback
 */
Repository.prototype.removeRemote = function(remote, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'remote rm', [], remote);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Removes the given remote
 * #removeRemoteSync
 * @param {string} remote
 */
Repository.prototype.removeRemoteSync = function(remote) {
    var self = this;
    var cmd = new Command(self.path, 'remote rm', [], remote);

    return cmd.execSync();
};

/**
 * Forwards a key-value list (remote : url) to the callback function
 * #getRemotes
 * @param  {Function} callback
 */
Repository.prototype.getRemotes = function(callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'remote', ['-v']);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null, parse.remotes(stdout));
    });
};

/**
 * Returns a key-value list (remote : url)
 * getRemotesSync
 * @param {function} callback
 */
Repository.prototype.getRemotesSync = function() {
    var self = this;
    var cmd = new Command(self.path, 'remote', ['-v']);

    return parse.remotes(cmd.execSync());
};

/**
 * Performs a GIT push to the given remote for the given branch name
 * #push
 * @param {string} remote
 * @param {string} branch
 * @param {array} flags
 * @param {object} creds
 * @param {function} callback
 */
Repository.prototype.push = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var remote = args[0];
    var branch = args[1];
    var done = args.slice(-1).pop();
    var flags = Array.isArray(args[2]) ? args[2] : null;
    var creds = null;

    if (flags && args[3].username) {
        creds = args[3];
    } else if (args[2].username) {
        creds = args[2];
    }

    return sync(self.path, {
        operation: 'push',
        remote: remote,
        branch: branch,
        flags: flags,
        credentials: creds || {
            username: null,
            password: null
        }
    }, done);
};

/**
 * Performs a GIT pull from the given remote with the given branch name
 * #pull
 * @param {string} remote
 * @param {string} branch
 * @param {array} flags
 * @param {object} creds
 * @param {function} callback
 */
Repository.prototype.pull = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var remote = args[0];
    var branch = args[1];
    var done = args.slice(-1).pop();
    var flags = Array.isArray(args[2]) ? args[2] : null;
    var creds = null;

    if (flags && args[3].username) {
        creds = args[3];
    } else if (args[2].username) {
        creds = args[2];
    }

    return sync(this.path, {
        operation: 'pull',
        remote: remote,
        branch: branch,
        flags: flags,
        credentials: creds || {
            username: null,
            password: null
        }
    }, done);
};

/**
 * Internal function to create a fake terminal to circumvent SSH limitations
 * @param {object} options
 * @param {function} callback
 */
function sync(path, opts, callback) {
    var self = this;
    var done = callback || function() {};
    var flags = opts.flags || [];
    var creds = opts.credentials;
    var options = [opts.remote, opts.branch].concat(flags);
    var cmd = new Command(path, opts.operation, options);

    cmd.exec(function(err, stdout, stderr) {
        done(err);
    });
}

/**
 * Resets the repository's HEAD to the specified commit
 * #reset
 * @param {string} hash
 * @param {function} callback
 */
Repository.prototype.reset = function(hash, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'reset', ['--hard'], hash);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        self.log(function(err, log) {
            if (err) {
                return done(err);
            }

            done(null, log);
        });
    });
};

/**
 * Resets the repository's HEAD to the specified commit
 * #resetSync
 * @param {string} hash
 */
Repository.prototype.resetSync = function(hash) {
    var self = this;
    var cmd = new Command(self.path, 'reset', ['--hard'], hash);

    cmd.execSync();

    return self.logSync();
};

/**
 * Forwards the current commit hash to the callback function
 * #describe
 * @param {function} callback
 */
Repository.prototype.describe = function(callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'describe', ['--always']);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null, stdout);
    });
};

/**
 * Returns the current commit hash
 * #describeSync
 */
Repository.prototype.describeSync = function() {
    var self = this;
    var cmd = new Command(self.path, 'describe', ['--always']);

    return cmd.execSync();
};

/**
 * Allows cherry-picking
 * #cherryPick
 * @param {string} commit - commit hash
 * @param {function} callback
 */
Repository.prototype.cherryPick = function(commit, callback) {
    var self = this;
    var done = callback || function() {};
    var cmd = new Command(self.path, 'cherry-pick', [], commit);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }

        done(null);
    });
};

/**
 * Allows cherry-picking
 * #cherryPickSync
 * @param {string} commit - commit hash
 * @param {function} callback
 */
Repository.prototype.cherryPickSync = function(commit) {
    var self = this;
    var cmd = new Command(self.path, 'cherry-pick', [], commit);

    return cmd.execSync();
};

/**
 * Allows show
 * #show
 * @param {string} commit
 * @param {string} filePath - full path of the file relative to the repo
 * @param {function} callback
 */
Repository.prototype.show = function(commit, filePath, callback) {
    var self = this;
    var done = callback || function() {};
    var revision = commit + ':' + filePath;
    var cmd = new Command(self.path, 'show', [], revision);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }
        done(null, stdout);
    });
};

/**
 * Allows show
 * #showSync
 * @param {string} commit - commit hash
 * @param {string} filePath - full path of the file relative to the repo
 */
Repository.prototype.showSync = function(commit, filePath) {
    var self = this;
    var revision = commit + ':' + filePath;
    var cmd = new Command(self.path, 'show', [], revision);

    return cmd.execSync();
};

/**
 * Performs a GIT fetch from all the remotes
 * #fetch
 * @param {array} flags
 * @param {object} creds
 * @param {function} callback
 */
Repository.prototype.fetch = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var done = args.slice(-1).pop();
    var flags = Array.isArray(args[0]) ? args[0] : null;
    var creds = null;

    if (flags && args[1].username) {
        creds = args[1];
    }

    return sync(this.path, {
        operation: 'fetch',
        remote: '',
        branch: '',
        flags: flags,
        credentials: creds || {
            username: null,
            password: null
        }
    }, done);
};

/**
 * Performs a GIT remote 
 * #remote
 * @param {string} remote
 * @param {array} flags
 * @param {function} callback
 */
Repository.prototype.remote = function() {
    var self = this;
    var args = Array.prototype.slice.apply(arguments);
    var remote = args[0];
    var flags = Array.isArray(args[1]) ? args[1] : [];
    var done = args.slice(-1).pop();

    var cmd = new Command(self.path, 'remote', flags, remote);

    cmd.exec(function(err, stdout, stderr) {
        if (err) {
            return done(err);
        }
        done(null, parse.repoInfo(stdout));
    });
};

/**
 * Export Constructor
 * @type {object}
 */
module.exports = Repository;
