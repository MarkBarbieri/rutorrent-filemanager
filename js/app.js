function FileManager () {

    var flm = this;

    var pluginUrl = 'plugins/filemanager';

    var getPlugin = function () {
        return thePlugins
            .get('filemanager');
    };


    var apiClient = function(endpoint) {

        endpoint = endpoint || getPlugin().path + 'action.php';
        return  {
            endpoint: endpoint,
            get: function(data) {
                return this.request('GET', data);
            },
            post: function(data) {
                return this.request('POST', data);
            },
            request : function(type, data)
            {
                type = type || 'GET';

                var deferred = Q.defer();

                $.ajax({
                    type : type,
                    url : endpoint +'?_=' + Math.floor(Date.now() / 1000),
                    timeout : theWebUI.settings["webui.reqtimeout"],
                    async : true,
                    cache : false,
                    data : data,
                    dataType : "json",

                    error : function(XMLHttpRequest, textStatus, errorThrown) {
                        deferred.reject({'response': XMLHttpRequest, textStatus, errorThrown});
                    },
                    success : function(data, textStatus) {
                        deferred.resolve({'response': [data, textStatus]});
                    }
                });

                return  deferred.promise;

            },
        };
    };

    var utils = function () {

        return {

            isDir : function(element) {
                return (element.charAt(element.length - 1) == '/');
            },


            getExt : function(element) {


                if (!$type(element)) {
                    return '';
                }

                var ext = element.split('.').pop();
                var valid = (element.split('.').length > 1 ) && ext.match(/^[A-Za-z0-9]{2,5}$/);

                ext = valid ? ext : '';


                return  ext.toLowerCase();
            },

            encode_string : function(str) {

                return encodeURIComponent(flmUtil.json_encode(str));

            },


            json_encode : function(obj) {
                switch($type(obj)) {
                    case "number":
                        return (String(obj));
                    case "boolean":
                        return ( obj ? "1" : "0");
                    case "string":
                        return ('"' + obj + '"');
                    case "array": {
                        var s = '';
                        $.each(obj, function(key, item) {
                            if (s.length)
                                s += ",";
                            s += flmUtil.json_encode(item);
                        });
                        return ("[" + s + "]");
                    }
                    case "object": {
                        var s = '';
                        $.each(obj, function(key, item) {
                            if (s.length)
                                s += ",";
                            s += ('"' + key + '":' + flmUtil.json_encode(item));
                        });
                        return ("{" + s + "}");
                    }
                }
                return ("null");
            },


            sortAlphaNumeric: function(x, y) {

                if (x.key.split('_flm_')[1] == theWebUI.fManager.getLastPath(theWebUI.fManager.curpath)) {
                    return (this.reverse ? 1 : -1);
                }
                return (this.oldFilesSortAlphaNumeric(x, y));
            },

            addslashes : function(str) {
                // http://phpjs.org/functions/addslashes:303
                return (str + '').replace(/[\\"\/]/g, '\\$&').replace(/\u0000/g, '\\0');
            }

        };

    };

    var views = function () {
        self = this;
        self.viewsPath = pluginUrl+'/views';
        var viewsConfig = {
            id: "create-archive",
            href: viewsPath+"/create-archive.html",
            // for this example we'll block until the template is loaded
            async: true,

            // The default is to load asynchronously, and call the load function
            //   when the template is loaded.

            load: function(template) {

                console.log('got view template', template, template.render({'dummy': "var data for dummy"}));
                return template;
            }
        };

        var initViews = function ()
        {

            var res = Twig.twig(viewsConfig);


            console.log("got compiled temlates str", res);


            return res;
        };

        self.getView = function(path, fn, options) {
            //
            var data = {
                views: 'flm',
                lang: theUILang,
                settings: {
                    'twig options': {
                        href: viewsPath+'/'+path+'.twig'
                    }}
            };

            Twig.renderFile(undefined, data, function(dumb, template){
                fn(template);
            });
        };

        return self;

    };

    var userInterface = function()
    {

        var self = this;

        var fsBrowser = function(){

            var self = this;

            self.navigationLoaded = false;
            self.initialFilesSortAlphaNumeric = null;
            self.initialFileSortNumeric = null;

            self.loadNavigation = function() {
                if(!self.navigationLoaded)
                {
                    flm.views.getView('table-header', function (view)
                    {
                        self.navigationLoaded = true;
                        var plugin = getPlugin();
                        $('#'+plugin.ui.fsBrowserContainer).prepend(view);
                    });
                }
            };

            self.onShow = function() {
                console.log('Filemanager ui broswer onshow');
                self.loadNavigation();
                var table = self.table();
                if(table)
                {
                    flm.goToPath('/').then(function() {
                            table.refreshRows();
                            theWebUI.resize();
                    });

                    $('#fMan_showconsole').show();
                    // display table columns
                    table.refreshRows();

                }
            };

            self.onHide = function () {
                console.log('Filemanager ui broswer onhide');

                $('#fMan_showconsole').hide();
            };

            // table

            self.setSorting = function() {
                var table = theWebUI.getTable("flm");

                table.initialFileSortNumeric = table.sortNumeric;
                table.sortNumeric = self.sortNumeric;

                table.initialFilesSortAlphaNumeric = table.sortAlphaNumeric;
                table.sortAlphaNumeric = self.sortAlphaNumeric;
            };

            self.sortAlphaNumeric= function (x, y) {

                if (theWebUI.fManager.isTopDir(x.key.split('_flm_')[1])) {
                    return (this.reverse ? 1 : -1);
                }
                return (this.initialFilesSortAlphaNumeric(x, y));
            };

            self.sortNumeric = function (x, y) {
                if (theWebUI.fManager.isTopDir(x.key.split('_flm_')[1])) {
                    return (this.reverse ? 1 : -1);
                }
                return (this.initialFileSortNumeric(x, y));
            };

            self.table = function() {
                return theWebUI.getTable("flm");
            };

            self.updateColumnNames = function () {

                var table = self.table();

                table.renameColumnById('time', theUILang.fTime);
                table.renameColumnById('type', theUILang.fType);
                table.renameColumnById('perm', theUILang.fPerm);
            };

            return self;
        };

        // file operation dialogs
        var createDialogs = function() {

            plugin.attachPageToOptions($("<div>").attr("id", 'fMan_optPan').html(this.forms.optPan.content).get(0), theUILang[this.forms.optPan.title]);
            delete this.forms.optPan;

            var buttons = '<div class="aright buttons-list">' + '<input type="button" class="fMan_Start Button" value="' + theUILang.fDiagStart + '" class="Button" />' + '<input type="button" class="Cancel Button" value="' + theUILang.fDiagClose + '"/>' + '</div>';
            var consbut = '<div class="aright buttons-list">' + '<input type="button" id="fMan_ClearConsole" class="Button" value="Clear" class="Button" />' + '<input type="button" class="fMan_Stop Button" value="' + theUILang.fDiagStop + '" class="Button" disabled="true"/>' + '<input type="button" class="Cancel Button" value="' + theUILang.fDiagClose + '"/>' + '</div>';

            var browsediags = {
                CreateSFV : theUILang.fDiagSFVHashfile,
                Move : theUILang.fDiagMoveTo,
                Copy : theUILang.fDiagCopyTo,
                Extract : theUILang.fDiagTo,
                Screenshots : 'Screens image:'
            };

            var pathbrowse;

            for (i in this.forms) {

                var dcontent = this.forms[i].content;

                if ($type(browsediags[i])) {

                    if ((i != 'Extract') || (i != 'Screenshots')) {
                        dcontent = $(this.forms[i].content).append('<div id="fMan_' + i + 'list" class="checklist"><ul></ul></div>');
                    }

                    pathbrowse = $('<fieldset>').html($('<legend>').text(browsediags[i])).append($('<input type="text" style="width:350px;" autocomplete="off" />').attr('id', 'fMan_' + i + 'bpath').addClass('TextboxLarge')).append($('<input type="button" value="..." style="float: right;" />').attr('id', 'fMan_' + i + 'bbut').addClass('Button aright'));
                } else if (i == 'Delete') {
                    dcontent = $(this.forms[i].content).append('<div id="fMan_' + i + 'list" class="checklist"><ul></ul></div>');
                    pathbrowse = '';
                } else {
                    pathbrowse = '';
                }

                var fcontent = $('<div>').html($('<div>').addClass('cont fxcaret').html(dcontent).append(pathbrowse)).append((i != 'Nfo') ? ((i == 'Console') ? consbut : buttons) : '').get(0);
                theDialogManager.make('fMan_' + i, theUILang[this.forms[i].title], fcontent, this.forms[i].modal);
            };

            /*
             Dialogs button binds bellow:
             */

            $('.fMan_Start').click(function() {

                var diagid = $(this).parents('.dlg-window:first').attr('id');
                diagid = diagid.split('fMan_');

                switch(diagid[1]) {
                    case 'CArchive':
                        theWebUI.fManager.doArchive(this, diagid[1]);
                        break;
                    case 'CheckSFV':
                        theWebUI.fManager.doSFVcheck(this, diagid[1]);
                        break;
                    case 'CreateSFV':
                        theWebUI.fManager.doSFVcreate(this, diagid[1]);
                        break;
                    case 'Copy':
                        theWebUI.fManager.doCopy(this, diagid[1]);
                        break;
                    case 'Delete':
                        theWebUI.fManager.doDelete(this, diagid[1]);
                        break;
                    case 'Extract':
                        theWebUI.fManager.doExtract(this, diagid[1]);
                        break;
                    case 'mkdir':
                        theWebUI.fManager.doNewDir();
                        break;
                    case 'Move':
                        theWebUI.fManager.doMove(this, diagid[1]);
                        break;
                    case 'Rename':
                        theWebUI.fManager.doRename();
                        break;
                    case 'Screenshots':
                        theWebUI.fManager.doScreenshots(this, diagid[1]);
                        break;
                }

            });

            $('.fMan_Stop').click(function() {

                theWebUI.fManager.cmdlog(theUILang.fStops[theWebUI.fManager.activediag] + "\n");
                theWebUI.fManager.actStop();

            });

            if (thePlugins.isInstalled("_getdir")) {

                browsediags.CArchive = 'arch';
                var closehandle = function(diagid) {
                    theDialogManager.setHandler('fMan_' + diagid, 'afterHide', function() {
                        plugin["bp" + diagid].hide();
                    });
                };

                for (sex in browsediags) {
                    plugin['bp' + sex] = new theWebUI.rDirBrowser('fMan_' + sex, 'fMan_' + sex + 'bpath', 'fMan_' + sex + 'bbut', null, false);
                    closehandle(sex);
                }

            } else {
                for (sex in browsediags) {
                    $('fMan_' + sex + 'bbut').remove();
                }
            }

            $('#fMan_pathsel').change(function() {
                var path = $(this).val();
                if (path == theWebUI.fManager.curpath) {
                    return false;
                }

                theWebUI.fManager.action.getlisting(path);
            });

            $("#fMan_multiv").change(function() {

                var dis = $(this).is(':checked');
                $("#fMan_vsize").attr("disabled", !dis);
            });

            $("#fMan_archtype").change(function() {

                var type = $(this).val();
                var comp = $("#fMan_archcompr");

                var ext;

                switch(theWebUI.fManager.archives.types[type]) {
                    case 'gzip':
                        ext = 'tar.gz';
                        break;
                    case 'bzip2':
                        ext = 'tar.bz2';
                        break;
                    default:
                        ext = theWebUI.fManager.archives.types[type];
                }

                $('#fMan_CArchivebpath').val(theWebUI.fManager.recname(theWebUI.fManager.recname($('#fMan_CArchivebpath').val())) + '.' + ext);
                $("#fMan_vsize").attr("disabled", (!$("#fMan_multiv").attr("disabled", (type != 0)).is(':checked') || (type != 0)));
                $('#fMan_apassword').attr("disabled", (type != 0));
                comp.empty();

                for (var i = 0; i < theWebUI.fManager.archives.compress[type].length; i++) {
                    comp.append('<option value="' + i + '">' + theUILang.fManArComp[type][i] + '</option>');
                }

            });

            $("#fMan_nfoformat").change(function() {

                var mode = $(this).val();
                var nfofile = $("#fMan_nfofile").val();

                theWebUI.fManager.viewNFO(nfofile, mode);
            });

            $('#fMan_ClearConsole').click(function() {
                theWebUI.fManager.cleanlog();
            });
            $('#fMan_navbut').click(function() {
                theWebUI.fManager.Refresh();
            });

            if (!thePlugins.isInstalled('data')) {

                $(document.body).append($("<iframe name='datafrm'/>").css({
                    visibility : "hidden"
                }).attr({
                    name : "datafrm",
                    id : "datafrm"
                }).width(0).height(0).load(function() {
                    var d = (this.contentDocument || this.contentWindow.document);
                    if (d.location.href != "about:blank")
                        try {
                            eval(d.body.innerHTML);
                        } catch(e) {
                        }
                }));
            }

            $(document.body).append($('<form action="' + theWebUI.fManager.action.requrl + '" id="fManager_getdata" method="post" target="datafrm">' + '<input type="hidden" name="dir" id="fManager_dir" value="">' + '<input type="hidden" name="target" id="fManager_getfile" value="">' + '<input type="hidden" name="action" value="fileDownload">' + '</form>').width(0).height(0));

        };


        self.browser = null;
        self.settings = {
            init: false,
            onShow: function (arg) {
                console.log('flm.ui.settings on Show', arg);
                // plugin config tab in UI settings

                var self  = this;
                // 1 dialog is enough :)
                if(self.init)
                {
                    self.updateSettings();
                } else {
                    flm.views.getView('settings-page', function (view)
                    {
                        self.init = true;
                        getPlugin()
                            .attachPageToOptions(view, theUILang.fManager);
                        self.updateSettings();

                    });
                }


            },
            updateSettings: function () {
                $('#fMan_optPan').find('input, select')
                    .each(function(index, ele)
                    {
                        var inid = ele.id.split('fMan_Opt');

                        if ($(ele).attr('type') == 'checkbox') {
                            if (theWebUI.settings["webui.fManager." + inid[1]]) {
                                $(ele).attr('checked', 'checked');
                            }
                        } else if ($(ele).is("select")) {
                            $(ele).children('option[value="' + theWebUI.settings["webui.fManager." + inid[1]] + '"]').attr('selected', 'selected');
                        } else {
                            $(ele).val(theWebUI.settings["webui.fManager." + inid[1]]);
                        }
                    });

            }
        };

        self.init = function () {
            var self = this;
            console.log('flm.ui.init', this);

            // file navigation
            self.initFileBrowser();

            // operation dialogs

        };


        self.initFileBrowser = function()
        {
            self.browser = fsBrowser();

            $('#tab_lcont').append('<input type="button" id="fMan_showconsole" class="Button" value="Console" style="display: none;">');
            $('#fMan_showconsole').click(function() {
                theWebUI.fManager.makeVisbile('fMan_Console');
            });


            self.browser.updateColumnNames();
            self.browser.setSorting();

            // table
        },


        self.getPopupId = function(popupName) {
            return 'fMan_' + popupName;
        };

        self.doSel  = function(diag) {

            diag = self.getPopupId(diag);

            var forcedirs = (diag == 'fMan_CreateSFV') ? true : false;

            if (!(theWebUI.fManager.actiontoken.length > 1)) {
                this.generateSelection($('#' + diag + 'list'), forcedirs);
                $('#' + diag + ' .fMan_Start').attr('disabled', false);
            }

            this.makeVisbile(diag);
        };

        self.doArchive = function(button, diag) {

            var archive = this.checkInputs(diag);
            if (archive === false) {
                return false;
            }
            if (this.fileExists(this.basename(archive + '/'))) {
                alert(theUILang.fDiagArchempty);
                return false;
            }

            if (!this.buildList('fMan_' + diag)) {
                return false;
            }

            var type = $("#fMan_archtype").val();
            var vsize = ((this.archives.types[type] != 'zip') && $("#fMan_multiv").is(':checked') && $("#fMan_vsize").val().match(/^\d+$/)) ? $("#fMan_vsize").val() : 0;
            var compression = $('#fMan_archcompr').val();
            var password = $('#fMan_apassword').val();

            var self = this;

            var options = {
                format : self.settings.arcnscheme,
                type : type,
                compression : compression,
                vsize : vsize,
                password : password
            };

            $(button).attr('disabled', true);
            this.actStart(diag);

            var actioncall = {
                method : 'filesCompress',
                target : archive,
                mode : options,
                fls: theWebUI.fManager.actionlist
            };

            this.action.postRequest({action : flmUtil.json_encode(actioncall)});


        };

        self.doExtract = function(button, diag) {

            var path = this.checkInputs(diag, true);
            if (path === false) {
                return false;
            }

            var archive = $('#fMang_Archfile').text();

            $(button).attr('disabled', true);

            this.actStart(diag);

            var actioncall = {
                method : 'fileExtract',
                target : archive,
                to: path
            };

            this.action.postRequest({action : flmUtil.json_encode(actioncall)});
        };

        self.doSFVcheck = function(button, diag) {

            var sfvfile = $('#fMang_ChSFVfile').text();
            $(button).attr('disabled', true);

            var fparts = sfvfile.split('/');

            this.actStart(diag);


            var actioncall = {
                method : 'svfCheck',
                target : fparts.pop()
            };


            this.action.postRequest({action : flmUtil.json_encode(actioncall)});


        };

        self.doSFVcreate = function(button, diag) {

            var file = this.checkInputs(diag);
            if (file === false) {
                return false;
            }
            if (this.fileExists(this.basename(file + '/'))) {
                alert(theUILang.fDiagSFVempty);
                return false;
            }

            if (!this.buildList('fMan_' + diag)) {
                return false;
            }

            $(button).attr('disabled', true);
            this.actStart(diag);


            var actioncall = {
                method : 'sfvCreate',
                target : file,
                fls: theWebUI.fManager.actionlist
            };


            this.action.postRequest({action : flmUtil.json_encode(actioncall)});

        };

        self.doDelete =function() {
            self.doSel('Delete');
        };

        return self;
    };

    var fileMenu = {};



    flm.apiClient = apiClient();

    flm.api = {

        promise: null,
        getDir : function(dir, callback) {

            var data = {
                'method' : 'listDirectory',
                'dir' : dir
            };

            return flm.apiClient.post(data)
                .then(
                    function (response) {
                        callback === undefined || callback(response);
                    },
                    function (response) {
                       // log(theUILang.fErrMsg[9]);
                        console.error(response);

                        log(theUILang.fErrMsg[10] + ' - ' + dir);

                    }
                );
        },

        stats : function(diag) {

            var actioncall = {
                method : 'taskLog',
                target : theWebUI.fManager.actiontoken,
                to : theWebUI.fManager.actionlp
            };

            var responseHandle = function(data) {
                theWebUI.fManager.actionstats = data.status;
                theWebUI.fManager.actionlp = data.lp;
                theWebUI.fManager.cmdlog(data.lines);

                if (!theWebUI.fManager.isErr(data.errcode) && (data.status < 1)) {
                    theWebUI.fManager.actiontimeout = setTimeout(theWebUI.fManager.action.stats, 1000);
                } else {
                    theWebUI.fManager.cleanactions();
                    if (theWebUI.fManager.curpath == theWebUI.fManager.workpath) {
                        theWebUI.fManager.Refresh();
                    }
                }
            };



            theWebUI.fManager.action.postRequest({
                action : flmUtil.json_encode(actioncall)
            }, responseHandle);

        }
    };

    flm.goToPath  = function(dir)
    {
        $('#fManager_data table').addClass('disabled_table');
        theWebUI.fManager.inaction = true;

        return flm.api.getDir(dir, function(data) {
            theWebUI.fManager.inaction = false;
            console.log('getlisting callback', data);
            theWebUI.fManager.parseReply(data, dir);

        });

    };

    var instance = {
        archives: {},
        paths : [],
        curpath : '/',
        workpath : '/',
        settings : {
            timef : '%d-%M-%y %h:%m:%s',
            permf : 1,
            histpath : 5,
            stripdirs : true,
            showhidden : true,
            cleanlog : false,
            arcnscheme : 'new',
            scrows : 12,
            sccols : 4,
            scwidth : 300
        },
        pathlists : 5,
        permf : 0,
        tformat : '%d-%M-%y %h:%m:%s',
        inaction : false,
        actionlist : {},
        actionstats : 0,
        actiontoken : 0,
        actiontimeout : 0,
        actionlp : 0,
        activediag : '',
        homedir : '',

        selectedTarget: null,
        forms: {},
        table: uiTable,
        actionCheck : function(diag) {

            if ((this.actiontimeout > 0) && (this.activediag != diag)) {
                return null;
            }

            if (!this.forms[diag].hasOwnProperty('funct')) {
                return null;
            }

            var args = "";

            var i = (arguments.length > 1) ? 1 : 0;

            for ( i = i; i < arguments.length; i++) {

                var rg;

                switch($type(arguments[i])) {
                    case 'string':
                        rg = '"' + flmUtil.addslashes(arguments[i]) + '"';

                        break;
                    default:
                        rg = arguments[i];
                }

                args += rg + ($type(arguments[i + 1]) ? ',' : '');

            }

            return 'theWebUI.fManager.' + this.forms[diag].funct + '(' + args + ')';

        },

        actStart : function(diag) {

            this.makeVisbile('fMan_Console');
            var loader = './images/ajax-loader.gif';
            if (thePlugins.isInstalled('create')) {
                loader = './plugins/create/images/ajax-loader.gif';
            }
            $('#fMan_Console .buttons-list').css("background", "transparent url(" + loader + ") no-repeat 15px 2px");
            $(".fMan_Stop").attr('disabled', false);
            this.activediag = diag;
            if (this.settings.cleanlog) {
                $('#fMan_ClearConsole').click();
            } else {
                this.cmdlog("-------\n");
            }

            this.cmdlog(theUILang.fStarts[diag] + "\n");

            theDialogManager.hide('fMan_' + diag);
        },

        actStop : function() {
            this.loaderHide();
            this.action.request('action=kill&target=' + encodeURIComponent(theWebUI.fManager.actiontoken));
            this.cleanactions();
        },

        Archive : function(name, ext) {

            if (!(theWebUI.fManager.actiontoken.length > 1)) {

                this.doSel('CArchive');

                $('#fMan_CArchivebpath').val(this.homedir + this.curpath + this.recname(name) + '.' + this.archives.types[ext]);

                var type = $('#fMan_archtype').empty();

                $.each(this.archives.types, function(index, value) {

                    var opt = '<option value="' + index + '">' + value.toUpperCase() + '</option>';
                    type.append((index == ext) ? $(opt).attr('selected', 'selected').get(0) : opt);
                });

                type.change();
            }

            this.makeVisbile('fMan_CArchive');
        },

        basename : function(str) {

            var isdir = flmUtil.isDir(str);
            var path = this.trimslashes(str);

            var bname = path.split('/').pop();

            return ((isdir) ? bname + '/' : bname);
        },

        buildList : function(diag) {

            var checks = $('#' + diag + ' .checklist input:checked');
            if (checks.size() == 0) {
                alert("Nothing is not a option");
                return false;
            }

            checks.each(function(index, val) {
                theWebUI.fManager.actionlist[index] = flmUtil.addslashes(decodeURIComponent(val.value));

            });

            return true;
        },

        checkInputs : function(diag, forcedir) {

            forcedir = $type(forcedir) ? true : false;

            var path = $.trim($('#fMan_' + diag + 'bpath').val());

            if (!path) {
                theDialogManager.hide('fMan_' + diag);
                return false;
            }
            if (path.length < this.homedir.length) {
                alert(theUILang.fDiagNoPath);
                return false;
            }

            path = path.split(this.homedir);
            path = this.trimslashes(path[1]);

            if ((path == this.trimslashes(this.curpath)) && !forcedir) {
                alert(theUILang.fDiagNoPath);
                return false;
            }

            var funky = this.trimslashes(this.curpath) ? this.trimslashes(path.split(this.trimslashes(this.curpath)+'/')[1]).split('/').shift() : path.split('/').shift();
            if (this.isChecked('fMan_' + diag, this.basename(path)) || this.fileExists(funky)) {
                alert(theUILang.fDiagNoPath);
                return false;
            }

            return '/' + path;
        },

        cleanactions : function() {

            $(".fMan_Stop").attr('disabled', true);
            clearTimeout(theWebUI.fManager.actiontimeout);
            this.loaderHide();
            theWebUI.fManager.activediag = '';
            theWebUI.fManager.actionlist = {};
            theWebUI.fManager.actionstats = 0;
            theWebUI.fManager.actiontoken = 0;
            theWebUI.fManager.actiontimeout = 0;
            theWebUI.fManager.actionlp = 0;
        },

        cleanlog : function() {

            $('#fMan_ConsoleLog pre').empty();
        },

        cmdlog : function(text) {

            var console = $('#fMan_ConsoleLog');

            if (browser.isIE) {
                console.innerHTML = "<pre>" + console.html() + text + "</pre>";
            } else {
                console.children('pre').append(text);
            }

            console[0].scrollTop = console[0].scrollHeight;
        },

        changedir : function(target) {

            var dir;

            if (target == this.getLastPath(this.curpath)) {
                dir = this.getLastPath(this.curpath);
            } else if (target == '/') {
                dir = target;
            } else {
                dir = this.curpath + target;
            }

            this.action.getlisting(dir);
        },

        Copy : function(diag) {
            $('#fMan_' + diag + 'bpath').val(this.homedir + this.curpath);
            this.doSel(diag);

        },

        createDir : function(dirname) {

            $('#fMan-NewDirPath').text(theWebUI.fManager.curpath);
            this.makeVisbile('fMan_mkdir');
        },

        createScreenshots : function(target) {

            if (!(theWebUI.fManager.actiontoken.length > 1)) {

                $('#fMan_Screenshotslist').html(theWebUI.fManager.curpath + '<strong>' + target + '</strong>');
                $('#fMan_Screenshotsbpath').val(this.homedir + this.curpath + 'screens_' + this.recname(target) + '.png');
                $('#fMan_Screenshots .fMan_Start').attr('disabled', false);
            }

            this.makeVisbile('fMan_Screenshots');
        },

        createT : function(target) {

            $('#path_edit').val(this.homedir + this.curpath + target);
            if ($('#tcreate').css('display') == 'none') {
                theWebUI.showCreate();
            }
        },




        doDelete : function(button, diag) {

            if (!this.buildList('fMan_' + diag)) {
                return false;
            }

            $(button).attr('disabled', true);

            this.actStart(diag);

            var actioncall = {
                method : 'filesRemove',
                fls: theWebUI.fManager.actionlist
            };

            this.action.postRequest({action : flmUtil.json_encode(actioncall)});

        },

        doMove : function(button, diag) {

            var path = this.checkInputs(diag);

            if (path === false) {
                return false;
            }
            if (!this.buildList('fMan_' + diag)) {
                return false;
            }

            $(button).attr('disabled', true);



            this.actStart(diag);

            var actioncall = {
                method : 'filesMove',
                to : path,
                fls : theWebUI.fManager.actionlist
            };

            this.action.postRequest({
                action : flmUtil.json_encode(actioncall)
            });

        },

        doCopy : function(button, diag) {

            var path = this.checkInputs(diag);

            if (path === false) {
                return false;
            }
            if (!this.buildList('fMan_' + diag)) {
                return false;
            }

            $(button).attr('disabled', true);

            this.actStart(diag);

            var actioncall = {
                method : 'filesCopy',
                to : path,
                fls : theWebUI.fManager.actionlist
            };

            this.action.postRequest({
                action : flmUtil.json_encode(actioncall)
            });

            //this.action.request('action=cp&to='+encodeURIComponent(path)+'&fls='+this.encode_string(theWebUI.fManager.actionlist));
        },

        doNewDir : function() {

            var ndn = $.trim($('#fMan-ndirname').val());

            if (!ndn.length) {
                theDialogManager.hide('fMan_mkdir');
                return false;
            }
            if (!this.validname(ndn)) {
                alert(theUILang.fDiagInvalidname);
                return false;
            }

            if (this.fileExists(ndn) || this.fileExists(ndn + '/')) {
                alert(theUILang.fDiagAexist);
                return false;
            }

            theWebUI.fManager.workpath = $('#fMan-NewDirPath').text();

            var callback = function(data) {
                if ((theWebUI.fManager.curpath == theWebUI.fManager.workpath) && !theWebUI.fManager.isErr(data.errcode, ndn)) {
                    theWebUI.fManager.Refresh();
                }
                theDialogManager.hide('fMan_mkdir');
            };



            var actioncall = {
                method : 'newDirectory',
                target: ndn
            };

            this.action.postRequest(
                {
                    action : flmUtil.json_encode(actioncall)
                },
                callback,
                function() {
                    log(theUILang.fErrMsg[9]);
                }, function() {
                    log(theUILang.fErrMsg[4] + ' - ' + ndn);
                });


        },

        doRename : function() {

            var nn = $.trim($('#fMan-RenameTo').val());
            var on = this.basename($('#fMan-RenameWhat').text());

            if (!nn.length || (on == nn)) {
                theDialogManager.hide('fMan_Rename');
                return false;
            }
            if (!theWebUI.fManager.validname(nn)) {
                alert(theUILang.fDiagInvalidname);
                return false;
            }

            if (theWebUI.fManager.fileExists(nn) || theWebUI.fManager.fileExists(nn + '/')) {
                alert(theUILang.fDiagAexist);
                return false;
            }

            var callback = function(data) {
                if ((theWebUI.fManager.curpath == theWebUI.fManager.workpath) && !theWebUI.fManager.isErr(data.errcode, on)) {
                    theWebUI.fManager.Refresh();
                }
                theDialogManager.hide('fMan_Rename');
            };

            var actioncall = {
                method : 'fileRename',
                target : on,
                to : nn,
                fls: theWebUI.fManager.actionlist
            };


            this.action.postRequest({action : flmUtil.json_encode(actioncall)},
                callback,
                function() {
                    log(theUILang.fErrMsg[11]);
                }, function() {
                    log(theUILang.fErrMsg[12] + ' - Rename: ' + on);
                });

        },

        doScreenshots : function(button, diag) {

            var screen_file = this.checkInputs(diag);
            if (screen_file === false) {
                return false;
            }

            var video = $('#fMan_Screenshotslist').text();

            $(button).attr('disabled', true);

            this.actStart(diag);

            this.action.request('action=scrn&target=' + encodeURIComponent(video) + '&to=' + encodeURIComponent(screen_file));


            var actioncall = {
                method : 'fileScreenSheet',
                target : video,
                to : screen_file
            };


            this.action.postRequest({action : flmUtil.json_encode(actioncall)} );


        },


        extract : function(what, here) {
            if (!(theWebUI.fManager.actiontoken.length > 1)) {
                $('#fMang_Archfile').html(theWebUI.fManager.curpath + '<strong>' + what + '</strong>');
                $('#fMan_Extractbpath').val(this.homedir + this.curpath + ( here ? '' : this.recname(what)));
                $('#fMan_Extract .fMan_Start').attr('disabled', false);
            }

            this.makeVisbile('fMan_Extract');
        },

        fileExists : function(what) {

            var table = theWebUI.getTable("flm");
            var exists = false;

            try {
                if (table.getValueById('_flm_' + what, 'name')) {
                    throw true;
                } else {
                    throw false;
                }
            } catch(dx) {
                if (dx === true) {
                    exists = dx;
                }
            }

            return exists;
        },

        formatDate : function(timestamp) {

            if (timestamp) {

                var d = new Date(timestamp * 1000);

                var times = {
                    s : d.getSeconds(),
                    m : d.getMinutes(),
                    h : d.getHours(),

                    d : d.getDate(),
                    M : d.getMonth(),
                    y : d.getFullYear()
                };

                for (i in times) {
                    if (i == 'M') {
                        times[i]++;
                    }
                    if (times[i] < 10) {
                        times[i] = "0" + times[i];
                    }
                }

                var ndt = this.settings.timef.replace(/%([dMyhms])/g, function(m0, m1) {
                    return times[m1];
                });
                return ndt;
            } else {
                return '';
            }
        },

        formatPerm : function(octal) {

            var pmap = ['-', '-xx', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
            var arr = octal.split('');

            var out = '';

            for ( i = 0; i < arr.length; i++) {
                out += pmap[arr[i]];
            }
            return out;

        },



        fPath : function() {

            var cpath = $('#fMan_pathsel');

            cpath.children('option').each(function(index, val) {
                if (val.value == theWebUI.fManager.curpath) {
                    $(this).attr('selected', 'selected');
                }
            });

            for (var i = 0; i < this.paths.length; i++) {
                if (this.paths[i] == this.curpath) {
                    return false;
                }
            }

            if (this.paths.length > this.pathlists) {
                this.paths.pop();
            }
            this.paths.unshift(this.curpath);

            cpath.empty();

            for (var i = 0; i < this.paths.length; i++) {

                cpath.append('<option>' + this.paths[i] + '</option>');
                if ((this.paths[i] != '/') && (i == (this.paths.length - 1))) {
                    cpath.append('<option value="/">/</option>');
                }
            }

        },

        generateSelection : function(holder, forcefiles) {

            forcefiles = $type(forcefiles) ? forcefiles : $type(forcefiles);

            var container = holder.children('ul');
            container.empty();

            var sr = theWebUI.getTable("flm").rowSel;
            var topdir = this.getLastPath(this.curpath);

            for (i in sr) {
                var name = i.split('_flm_');
                name = name[1];

                if (sr[i] && (name != topdir) && (!forcefiles || !flmUtil.isDir(name))) {
                    container.append('<li><label><input type="checkbox" value="' + encodeURIComponent(name) + '" checked="checked" />' + name + '</label></li>');
                }
            }
        },



        getLastPath : function(path) {

            var last = '/';
            path = this.trimslashes(path);

            if (path) {
                var ar = path.split('/');
                ar.pop();
                last += ar.join('/');
                if (ar.length > 0) {
                    last += '/';
                }
            }

            return (last);
        },

        getFile : function(id) {

            $("#fManager_dir").val(theWebUI.fManager.curpath);
            $("#fManager_getfile").val(id);
            $("#fManager_getdata").submit();

        },

        getICO : function(element) {

            if (flmUtil.isDir(element)) {
                return ('Icon_Dir');
            }

            var iko;

            element = flmUtil.getExt(element).toLowerCase();

            if (element.match(/^r[0-9]+$/)) {
                return ('Icon_partRar');
            }

            switch(element) {

                case 'mp3' :
                    iko = 'Icon_Mp3';
                    break;
                case 'avi':
                case 'mp4':
                case 'wmv':
                case 'mkv':
                case 'divx':
                case 'mov':
                case 'flv':
                case 'mpeg':
                    iko = 'Icon_Vid';
                    break;
                case 'bmp':
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                    iko = 'Icon_Img';
                    break;
                case 'nfo':
                    iko = 'Icon_Nfo';
                    break;
                case 'sfv':
                    iko = 'Icon_Sfv';
                    break;
                case 'rar':
                    iko = 'Icon_Rar';
                    break;
                case 'zip':
                    iko = 'Icon_Zip';
                    break;
                case 'tar':
                case 'gz':
                case 'bz2':
                    iko = 'Icon_gnuARCH';
                    break;
                case 'torrent':
                    iko = 'Icon_Torrent';
                    break;
                default:
                    iko = 'Icon_File';
            }

            return (iko);
        },

        Init: function () {

            this.loadConfig();
            this.optSet(); // plugins settings page

        },


        isChecked : function(diag, what) {

            var ret = false;

            $('#' + diag + ' .checklist input:checked').each(function(index, val) {
                if ((what == decodeURIComponent(val.value)) || (what + '/' == decodeURIComponent(val.value))) {
                    ret = true;
                    return false;
                }
            });

            return ret;
        },



        isErr : function(errcode, extra) {

            if (!$type(extra)) {
                extra = '';
            }

            if (errcode > 0) {
                log('FILE MANAGER: ' + theUILang.fErrMsg[errcode] + " : " + extra);
                return true;
            }

            return false;
        },


        isTopDir: function(file) {

            return (file == this.getLastPath(this.curpath) );
        },


        loadConfig: function() {
            var call = {
                method: 'getConfig'
            };

            var self = this;

            var callback = function (data) {

                console.log('got config data');
                console.log(data);

                for(var i in data) {

                    self[i] = data[i];
                }

                console.log(theWebUI.fManager);

                setTimeout(
                    function () {
                        instance.Refresh();

                    }, 1000
                );

            };

            this.action.postRequest({action : flmUtil.json_encode(call)}, callback);

        },

        loaderHide : function() {

            $('#fMan_Console .buttons-list').css("background", "none");
        },

        makeVisbile : function(what) {

            if ($('#' + what).css('overflow', 'visible').css('display') == 'none') {
                theDialogManager.toggle(what);
            }

        },

        mediainfo : function(what) {


            var calldata = {
                'action': 'fileMediaInfo',
                'target': what,
                'dir': theWebUI.fManager.curpath

            };

            theWebUI.startConsoleTask( "mediainfo", plugin.name, calldata, { noclose: true } );


            /*
            this.cleanlog();
                    this.cmdlog("Fetching...");

                    var self = this;

                    this.makeVisbile('fMan_Console');
                    var loader = './images/ajax-loader.gif';
                    if (thePlugins.isInstalled('create')) {
                        loader = './plugins/create/images/ajax-loader.gif';
                    }
                    $('#fMan_Console .buttons-list').css("background", "transparent url(" + loader + ") no-repeat 15px 2px");
                    $(".fMan_Stop").attr('disabled', true);

                    this.action.request('action=minfo&target=' + encodeURIComponent(what), function(data) {
                        if (theWebUI.fManager.isErr(data.errcode, what)) {
                            self.cmdlog('Failed fetching data');
                            return false;
                        }
                        self.cleanlog();
                        self.cmdlog(data.minfo);
                    });

                    this.loaderHide();*/


        },

        optSet : function() {

            if (theWebUI.configured) {
                uiTable.Init(); // table init

                var needsave = false;

                for (var set in theWebUI.fManager.settings) {
                    if ($type(theWebUI.settings["webui.fManager." + set])) {
                        theWebUI.fManager.settings[set] = theWebUI.settings["webui.fManager." + set];
                    } else {
                        theWebUI.settings["webui.fManager." + set] = theWebUI.fManager.settings[set];
                        needsave = true;
                    }
                }

                if (needsave) {
                    theWebUI.save();
                }

            } else {
                setTimeout(arguments.callee, 500);
            }
        },

        parseReply : function(reply, dir) {

            $('#fManager_data table').removeClass('disabled_table');

            if (this.isErr(reply.errcode, dir)) {
                return false;
            }

            this.curpath = dir;
            this.fPath();
            console.log('parseReply reply', reply, dir);
            this.TableData(reply.listing);

        },

        Refresh : function() {

            this.action.getlisting(this.curpath);
        },

        rename : function(what) {

            var type = (flmUtil.isDir(what)) ? 'Directory:' : 'File:';
            what = this.trimslashes(what);

            $('#fMan-RenameType strong').text(type);
            $('#fMan-RenameWhat').html(theWebUI.fManager.curpath + '<strong>' + what + '</strong>');
            $('#fMan-RenameTo').val(what);

            this.makeVisbile('fMan_Rename');

        },



        resize : function(w, h) {

            if (w !== null) {
                w -= 8;
            }

            if (h !== null) {
                h -= ($("#tabbar").height());
                h -= ($("#fMan_navpath").height());
                h -= 2;
            }

            var table = theWebUI.getTable("flm");
            if (table) {
                table.resize(w, h);
            }
        },

        recname : function(what) {

            if (flmUtil.isDir(what)) {
                return this.trimslashes(what);
            }

            var ext = flmUtil.getExt(what);

            var recf = what.split(ext);

            if (recf.length > 1) {
                recf.pop();
                recf = recf.join(ext).split('.');
                if (recf[recf.length - 1] == '') {
                    recf.pop();
                }
                return (recf.join('.'));
            }

            return (recf.join(''));

        },

        sfvCreate : function(what) {

            $('#fMan_CreateSFVbpath').val(this.homedir + this.curpath + this.recname(what) + '.sfv');
            theWebUI.fManager.doSel('CreateSFV');

        },

        sfvCheck : function(what) {

            if (!(theWebUI.fManager.actiontoken.length > 1)) {
                $('#fMang_ChSFVfile').html(theWebUI.fManager.curpath + '<strong>' + what + '</strong>');
                $('#fMan_CheckSFV .fMan_Start').attr('disabled', false);
            }

            this.makeVisbile('fMan_CheckSFV');
        },

        trimslashes : function(str) {

            if (!$type(str)) {
                return '';
            }

            var ar = str.split('/');
            var rar = [];

            for ( i = 0; i < ar.length; i++) {
                if (ar[i]) {
                    rar.push(ar[i]);
                }
            }

            return (rar.join('/'));
        },

        TableData : function(data) {

            var table = theWebUI.getTable("flm");

            var self = this;

            table.clearRows();

            if (this.curpath != '/') {
                table.addRowById({
                    name : '../',
                    size : '',
                    time : '',
                    type : '/',
                    perm : ''
                }, "_flm_" + this.getLastPath(this.curpath), 'Icon_UpD');
            } else {
                if (data.length < 1) {
                    data = {
                        0 : {
                            name : '/',
                            size : '',
                            time : '',
                            perm : ''
                        }
                    };
                }
            }


            $.each(data, function(ndx, file) {

                if (flmUtil.isDir(file.name)) {
                    var ftype = 0;
                } else {
                    var ftype = 1;
                }

                var entry = {
                    name : file.name,
                    size : file.size,
                    time : file.time,
                    type : ftype + file.name,
                    perm : file.perm
                };

                console.log('adding row ', entry, 'to table ', table);
                /*		table.addRowById(entry, "_flm_" + file.name, theWebUI.fManager.getICO(file.name));


                        if (!theWebUI.fManager.settings.showhidden && (file.name.charAt(0) == '.')) {
                            table.hideRow("_flm_" + file.name);
                        }*/
            });

        },

        TableRegenerate : function() {
            var td = theWebUI.getTable("flm").rowdata;
            var old = {};

            var x = 0;

            for (i in td) {
                if (td[i].icon == 'Icon_UpD') {
                    continue;
                }
                old[x] = {
                    name : td[i].data[0],
                    size : td[i].data[1],
                    time : td[i].data[2],
                    type : td[i].data[3],
                    perm : td[i].data[4]
                };
                x++;
            }

            this.TableData(old);
        },

        validname : function(what) {
            return (what.split('/').length > 1) ? false : true;
        },

        viewNFO : function(what, mode) {

            this.makeVisbile('fMan_Nfo');
            $("#fMan_nfoformat option[value='" + mode + "']").attr('selected', 'selected');

            var cont = $('#nfo_content pre');
            cont.empty();
            cont.text('			Loading...');

            $("#fMan_nfofile").val(what);


            var actioncall = {
                method : 'viewNfo',
                target : what,
                mode : mode
            };

            var callback = function(data) {

                if (theWebUI.fManager.isErr(data.errcode, what)) {
                    cont.text('Failed fetching .nfo data');
                    return false;
                }

                if (browser.isIE) {
                    document.getElementById("nfo_content").innerHTML = "<pre>" + data.nfo + "</pre>";
                } else {
                    cont.html(data.nfo);
                }

            };

            this.action.postRequest({action : flmUtil.json_encode(actioncall)}, callback);

        }
    };
    var uiTable = {
        container_name: 'fManager_data',
        bindDeleteKey: function (e) {

            theWebUI.fManager.doSel('Delete');

        },

        format: function (table, arr) {
            for (var i in arr) {
                if (arr[i] == null) {
                    arr[i] = '';
                } else {
                    switch (table.getIdByCol(i)) {
                        case 'name':
                            if (theWebUI.fManager.settings.stripdirs
                                && flmUtil.isDir(arr[i])) {
                                arr[i] = theWebUI.fManager.trimslashes(arr[i]);
                            }
                            break;
                        case 'size' :
                            if (arr[i] != '') {
                                arr[i] = theConverter.bytes(arr[i], 2);
                            }
                            break;
                        case 'type' :
                            if (flmUtil.isDir(arr[i])) {
                                arr[i] = '';
                            } else {
                                arr[i] = flmUtil.getExt(arr[i]);
                            }
                            break;
                        case 'time' :
                            arr[i] = theWebUI.fManager.formatDate(arr[i]);
                            break;
                        case 'perm':
                            if (theWebUI.fManager.settings.permf > 1) {
                                arr[i] = theWebUI.fManager.formatPerm(arr[i]);
                            }
                            break;
                    }
                }
            }
            return (arr);
        },

        Init: function () {
            var self = this;

            var table = {
                obj: new dxSTable(),
                columns: [{
                    text: theUILang.Name,
                    width: "210px",
                    id: "name",
                    type: TYPE_STRING
                }, {
                    text: theUILang.Size,
                    width: "60px",
                    id: "size",
                    type: TYPE_NUMBER
                }, {
                    text: ' ',
                    width: "120px",
                    id: "time",
                    type: TYPE_STRING,
                    "align": ALIGN_CENTER
                }, {
                    text: ' ',
                    width: "80px",
                    id: "type",
                    type: TYPE_STRING
                }, {
                    text: ' ',
                    width: "80px",
                    id: "perm",
                    type: TYPE_NUMBER
                }],
                container: self.container_name,
                format: self.format,
                onselect: function (e, id) {
                    if (theWebUI.fManager.inaction) {
                        return false;
                    }
                    theWebUI.fManager.flmSelect(e, id);
                },


                ondelete: self.bindDeleteKey,
                ondblclick: self.ondblclick
            };


            table.obj.oldFilesSortAlphaNumeric = table.obj.sortAlphaNumeric;
            table.obj.sortAlphaNumeric = this.sortAlphaNumeric;

            table.obj.oldFilesSortNumeric = table.obj.sortNumeric;
            table.obj.sortNumeric = this.sortNumeric;

            theWebUI.tables.flm = table;

            this.setColumnNames();

        },

        ondblclick: function (obj) {
            if (theWebUI.fManager.inaction) {
                return false;
            }
            var target = obj.id.slice(5, obj.id.length);

            if (flmUtil.isDir(target)) {
                theWebUI.fManager.changedir(target);
            } else {
                theWebUI.fManager.getFile(target);
            }

            return (false);
        },




    };


    flm.utils = utils();
    flm.views = views();
    flm.ui = userInterface();

    flm.manager = instance;

    return flm;
}

// namespace

window.flm = FileManager();
theWebUI.fManager = window.flm.manager;
theWebUI.fManager.flmSelect = function(e, id) {

    var target = id.split('_flm_')[1];
    var targetIsDir = flmUtil.isDir(target);

    if ($type(id) && (e.button == 2)) {

        theContextMenu.clear();

        var table = theWebUI.getTable("flm");
        var flm = theWebUI.fManager;



        theContextMenu.add([theUILang.fOpen, (table.selCount > 1) ? null : ( targetIsDir ? function() {
            flm.changedir(target);
        } : function() {
            flm.getFile(target);
        })]);

        if (target != flm.getLastPath(flm.curpath)) {

            flm.workpath = flm.curpath;

            var fext = flmUtil.getExt(target);

            if (fext == 'nfo') {
                theContextMenu.add([CMENU_SEP]);
                theContextMenu.add([theUILang.fView,
                    function() {
                        flm.viewNFO(target, 1);
                    }]);
                theContextMenu.add([CMENU_SEP]);
            }

            theContextMenu.add([theUILang.fCopy, flm.actionCheck('Copy')]);
            theContextMenu.add([theUILang.fMove, flm.actionCheck('Move')]);
            theContextMenu.add([theUILang.fDelete, flm.actionCheck('Delete')]);

            theContextMenu.add([theUILang.fRename, !(table.selCount > 1) ? flm.actionCheck('Rename', target) : null]);

            theContextMenu.add([CMENU_SEP]);

            if (fext.match(/^(zip|rar|tar|gz|bz2)$/i) && !(table.selCount > 1)) {
                theContextMenu.add([theUILang.fExtracta, flm.actionCheck('Extract', target, false)]);
                theContextMenu.add([theUILang.fExtracth, flm.actionCheck('Extract', target, true)]);
                theContextMenu.add([CMENU_SEP]);
            }

            var create_sub = [];

            create_sub.push([theUILang.fcNewTor, thePlugins.isInstalled('create') && !(table.selCount > 1) ? function() {
                flm.createT(target);
            } : null]);
            create_sub.push([CMENU_SEP]);
            create_sub.push([theUILang.fcNewDir, "theWebUI.fManager.createDir()"]);
            create_sub.push([theUILang.fcNewArchive, flm.actionCheck('CArchive', target, 0)]);
            create_sub.push([CMENU_SEP]);
            create_sub.push([theUILang.fcSFV, !targetIsDir ? flm.actionCheck('CreateSFV', target) : null]);

            create_sub.push([theUILang.fcScreens, (thePlugins.isInstalled('screenshots') && !targetIsDir && flmUtil.getExt(target).match(new RegExp("^(" + thePlugins.get('screenshots').extensions.join('|') + ")$", "i")) && !(this.actiontimeout > 0)) ? flm.actionCheck('Screenshots', target) : null]);

            theContextMenu.add([CMENU_CHILD, theUILang.fcreate, create_sub]);

            theContextMenu.add([theUILang.fcheckSFV, (fext == 'sfv') ? flm.actionCheck('CheckSFV', target) : null]);
            theContextMenu.add([theUILang.fMediaI, (thePlugins.isInstalled('mediainfo') && !targetIsDir && !(this.actiontimeout > 0)) ? function() {
                flm.mediainfo(target);
            } : null]);

        } else {
            theContextMenu.add([theUILang.fcNewDir, "theWebUI.fManager.createDir()"]);
        }

        theContextMenu.add([CMENU_SEP]);
        theContextMenu.add([theUILang.fRefresh, "theWebUI.fManager.Refresh()"]);

        theContextMenu.show();
        return (true);
    } else {
        // normal click - focus

        theWebUI.fManager.selectedTarget = target;

    }
    return (false);
};


