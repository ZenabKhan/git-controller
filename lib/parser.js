/**
 * @module gitty/parser
 */

var parsers = {};

/**
 * Logger function
 * @param {string} output
 * @return {string}
 */
parsers.log = function(output) {
    var log = '[' + output.substring(0, output.length - 1) + ']';

    // this function cleans the commit log from any double quotes breaking the
    // JSON string

    var jsonValueRegex = /".*?":"(.*?)"[,}]/g;

    var h = log.match(jsonValueRegex);

    if (h) {
        for (var i = h.length - 1; i >= 0; i--) {
            var hh = h[i].replace(jsonValueRegex, '$1');
            var hhh = hh.replace(/\"/g, '\\"').replace(/\'/g, "").replace( /\^</g, '<').replace( /\^>/g, '>');

            log = log.replace(hh, hhh);
        }
    }

    return JSON.parse(log);
};

/**
 * Output Handler for GIT status
 * @param {string} gitstatus
 * @param {string} untracked
 * @return {string}
 */
parsers.status = function(gitstatus, untracked) {
    untracked = untracked.split('\n');

    var fileStatus = null;
    var output = gitstatus.split('\n');

    var status = {
        staged: [],
        unstaged: [],
        untracked: untracked.slice(0, untracked.length - 1)
    };

    // iterate over lines
    output.forEach(function(line) {
        line = line.toLowerCase();

        // switch to staged array
        if (line.indexOf('changes to be committed') > -1) {
            fileStatus = 'staged';
        }
        // or switch to not_staged array
        else if (line.indexOf('changes not staged for commit') > -1) {
            fileStatus = 'unstaged';
        }
        // or switch to untracked array
        else if (line.indexOf('untracked files') > -1) {
            fileStatus = 'untracked';
        }

        var isModified = line.indexOf('modified') > -1;
        var isNewFile = line.indexOf('new file') > -1;
        var isDeleted = line.indexOf('deleted') > -1;

        // check if the line contains a keyword
        if (isModified || isNewFile || isDeleted) {
            // then remove # and all whitespace and split at the colon
            var fileinfo = line.substr(1).trim().split(':');
            // push a new object into the current array
            status[fileStatus].push({
                file: fileinfo[1].trim(),
                status: fileinfo[0]
            });
        }
    });

    return status;
};

/**
 * Output handler for GIT commit
 * @param {string} output
 * @return {string}
 */
parsers.commit = function(output) {
    var commitFailed = (output.indexOf('nothing to commit') > -1 ||
        output.indexOf('no changes added to commit') > -1);

    // if there is nothing to commit...
    if (commitFailed) {
        return {
            error: (function(output) {
                var lines = output.split('\n');
                for (var ln = 0; ln < lines.length; ln++) {
                    if (lines[ln].indexOf('#') === -1) {
                        return lines[ln];
                    }
                }
            })(output)

        };
    }

    var splitOutput = output.split('\n');
    var branchAndHash = splitOutput[0].match(/\[([^\]]+)]/g)[0];
    var branch = branchAndHash.substring(1, branchAndHash.length - 1);
    var hash = branchAndHash.substring(1, branchAndHash.length - 1);
    var filesChanged = splitOutput[1].split(' ')[0];
    var operations = splitOutput.splice(2);

    return {
        branch: branch.split(' ')[0],
        commit: hash.split(' ')[1],
        changed: filesChanged,
        operations: operations
    };
};

/**
 * Output handler for GIT branch command
 * @param {string} output
 * @return {string}
 */
parsers.branch = function(output) {
    var tree = {
        current: null,
        others: []
    };
    var branches = output.split('\n');

    branches.forEach(function(val, key) {
        if (val.indexOf('*') > -1) {
            tree.current = val.replace('*', '').trim();
        } else if (val) {
            tree.others.push(val.trim());
        }
    });

    return tree;
};

/**
 * Output handler for GIT tag command
 * @param {string} output
 * @return {string}
 */
parsers.tag = function(output) {
    var tags = output.split(/\r?\n/);

    for (var i = 0; i < tags.length; i++) {
        if (!tags[i].length) {
            tags.splice(i, 1);
        }
    }

    return tags;
};

/**
 * Output handler for GIT remote -v command
 * @param {string} output
 * @return {string}
 */
parsers.remotes = function(output) {
    var list = {};
    var parseme = output.split('\n');

    parseme.forEach(function(val, key) {
        if (val.split('\t')[0]) {
            list[val.split('\t')[0]] = val.split('\t')[1].split(' ')[0];
        }
    });

    return list;
};

/**
 * Output handler for GIT errors from GIT push and pull commands
 * @param {string} output
 * @return {string}
 */
parsers.syncErr = function(output) {
    var result = output.split('\r\n');

    for (var i = 0; i < result.length; i++) {
        if (!result[i].length) {
            result.splice(i, 1);
        }
    }

    return result;
};

/**
 * Output handler for GIT success messages from GIT push and pull commands
 * @param {string} output
 * @return {string}
 */
parsers.syncSuccess = function(output) {
    return output;
};

//helper functions for repoInfo

var local = [];
var remote = [];

function setLocalBranchInfo(branch, branchStatus) {
    local.push({
        branchName: branch,
        status: branchStatus
    });
}

function setRemoteBranchInfo(branch, branchStatus) {
    remote.push({
        branchName: branch,
        status: branchStatus
    });
}

function getRemoteBranchInfo(output) {
    var remoteBranches = [];
    var reg = /Remote branch[es]*:[\D\d]*Local branch[es]* configured for 'git pull':/;

    var match = (reg.exec(output) &&  reg.exec(output)[0]) || '';
    match = match.split('\n');

    for (i = 1; i < match.length - 1; i++) {
        var x = match[i].trim().split(/\s+/);
        remoteBranches.push(x[0]);
    }

    return remoteBranches;
}

/*
 * Output handler for GIT remote command
 * @param {string} output
 * @return {Object}
 */
parsers.repoInfo = function(output) {
    local = [];
    remote = [];
    
    var remoteBranches = getRemoteBranchInfo(output);
    var localBranches = [];

    var reg = /Local ref[s]* configured for 'git push':[\D\d]*/

    var match = reg.exec(output)[0];
    match = match.trim().split('\n');

    for (i = 1; i < match.length; i++) {
        var branchWithStatus = match[i].trim().split(/pushes to /);

        name = branchWithStatus[1].trim().substr(0, branchWithStatus[1].indexOf(' '))
        status = branchWithStatus[1].trim().substr(branchWithStatus[1].indexOf(' ') + 1);

        if (status.indexOf('(local out of date)') > -1) {

            setLocalBranchInfo(name, 'out-of-date');

            setRemoteBranchInfo(name, 'tracked');

            localBranches.push(name);
        } else if (status.indexOf('(up to date)') > -1) {

            setLocalBranchInfo(name, 'up-to-date');

            setRemoteBranchInfo(name, 'tracked');

            localBranches.push(name);
        }
    }

    remoteBranches.forEach(function(branch) {
        if (localBranches.indexOf(branch) < 0) {
            setRemoteBranchInfo(branch, false);
        }
    });

    return {
        remoteInfo: remote,
        localInfo: local
    };
}

/**
 * Export Contructor
 * @constructor
 * @type {object}
 */
module.exports = parsers;
