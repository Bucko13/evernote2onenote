var Evernote = require('evernote').Evernote;
var forEachAsync = require('async-foreach').forEach;

var config = require('../config.json');
var callbackUrl = "http://localhost:3000/oauth_callback";

// home page
exports.index = function(req, res) {
  if(req.session.oauthAccessToken) {
    var token = req.session.oauthAccessToken;
    var client = new Evernote.Client({
      token: token,
      sandbox: config.SANDBOX,
      china: config.CHINA
    });
    var noteStore = client.getNoteStore();
    noteStore.listNotebooks(function(err, notebooks){
      var notes = [];
      req.session.notebooks = notebooks;

      forEachAsync(notebooks, function(notebook, notebooksCount) {
        var done = this.async();
        //create filter for findNotesMetadata
        filter = new Evernote.NoteFilter();
        //set the notebook guid filter to the GUID of the default notebook
        filter.notebookGuid = notebook.guid;

        resultSpec = new Evernote.NotesMetadataResultSpec();
        //set the result spec to include titles
        resultSpec.includeTitle = true;
        resultSpec.includeNotebookGuid = true;

        noteStore.findNotesMetadata(
          token, filter, 0, 100, resultSpec,
          function(err, notesMeta) {
            if (err) throw new Error(err);

            // go through each note meta return and create new note object
            notesMeta.notes.forEach(function(noteMeta) {
              var note = {
                title: noteMeta.title,
                guid: noteMeta.guid,
                notebookGuid: noteMeta.notebookGuid,
              }
              notes.push(note);
            });

          // go through each note that we have guid and title for to get content
          forEachAsync(notes, function(note, notesCount) {
            console.log('getting content for note number:', notesCount);
            var done = this.async();

            noteStore.getNoteContent(token, note.guid, function(err, content) {
              if (err) throw new Error(err);
              // add content to each corresponding note object
              notes[notesCount].content = content;

              if (notebooksCount === notebooks.length -1 && notesCount === notes.length -1){
                //this means we're at the last note from the last notebook
                req.session.notes = notes;
                res.render('index');
              }

              // forEachAsync won't go to the next iteration until done is called
              done();
            });
          }); // --> end forEach note
        });
        done();
      });// --> end forEach notebook
    });
  } else {
    res.render('index');
  }
};

// OAuth
exports.oauth = function(req, res) {
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });

  client.getRequestToken(callbackUrl, function(error, oauthToken, oauthTokenSecret, results){
    if(error) {
      req.session.error = JSON.stringify(error);
      res.redirect('/');
    }
    else {
      // store the tokens in the session
      req.session.oauthToken = oauthToken;
      req.session.oauthTokenSecret = oauthTokenSecret;

      // redirect the user to authorize the token
      res.redirect(client.getAuthorizeUrl(oauthToken));
    }
  });

};

// OAuth callback
exports.oauth_callback = function(req, res) {
  var client = new Evernote.Client({
    consumerKey: config.API_CONSUMER_KEY,
    consumerSecret: config.API_CONSUMER_SECRET,
    sandbox: config.SANDBOX,
    china: config.CHINA
  });

  client.getAccessToken(
    req.session.oauthToken,
    req.session.oauthTokenSecret,
    req.param('oauth_verifier'),
    function(error, oauthAccessToken, oauthAccessTokenSecret, results) {
      if(error) {
        console.log('error');
        console.log(error);
        res.redirect('/');
      } else {
        // store the access token in the session
        req.session.oauthAccessToken = oauthAccessToken;
        req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
        req.session.edamShard = results.edam_shard;
        req.session.edamUserId = results.edam_userId;
        req.session.edamExpires = results.edam_expires;
        req.session.edamNoteStoreUrl = results.edam_noteStoreUrl;
        req.session.edamWebApiUrlPrefix = results.edam_webApiUrlPrefix;
        res.redirect('/');
      }
    });
};

// Clear session
exports.clear = function(req, res) {
  req.session.destroy();
  res.redirect('/');
};
