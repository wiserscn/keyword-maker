(function($) {
	'use strict';

	var _const = {
		rule: "Rule",
		operator: "Operator",
		list: "List",
		list_chip:"ListChip",
		comment: "Comment",
		canvas_oid: "oid_0",
		select_highlight_class: "select-highlight",
		copy_highlight_class: "copy-highlight",
		// * limit: argument count limitation;
		// * scopeRank: the larger it is, the wider scope it has. 0-no scope restriction
		// * hasDistanceDefine: whether has character distance and sentence distance
		operatorFuncs: {
			"AND/PAR": {limit: 1000, scopeRank: 10, hasDistanceDefine: false},
			"AND/SEN": {limit: 1000, scopeRank: 8, hasDistanceDefine: false},
			"AND/PRE": {limit: 1000, scopeRank: 6, hasDistanceDefine: true},
			"OR": {limit: 1000, scopeRank: 0, hasDistanceDefine: false},
			"AND": {limit: 1000, scopeRank: 0, hasDistanceDefine: false},
			"AND_NOT": {limit: 2, scopeRank: 0, hasDistanceDefine: false},
			"AND_NOT/PAR": {limit: 2, scopeRank: 10, hasDistanceDefine: false},
			"AND_NOT/SEN": {limit: 2, scopeRank: 8, hasDistanceDefine: false},
			"AND/NOT_PRE": {limit: 2, scopeRank: 6, hasDistanceDefine: true},
			"AND/PRE_NOT": {limit: 2, scopeRank: 6, hasDistanceDefine: true},
			"AND/NOT_PRE_NOT": {limit: 3, scopeRank: 6, hasDistanceDefine: true}
		},
		propAry: {
			Rule: ["arg-type", "arg-name", "score"],
			Operator: ["arg-type", "func", "char-distance", "sent-distance"],
			List: ["arg-type"],
			ListChip: ["arg-type", "arg-name", "ws-tolerance", "kwd-list"],
			Comment: ["arg-type"],
			Canvas: ["arg-type", "paste"]
		},
		defatultValue: {
			wsTolerance: 3
		}
	},
	_memo = {
		oid: 1, // for accumulate object id
		selected_arg_oid: "oid_0", // to store the select argument, oid_0 is the canvas object
		curFolderIndex: 0,
		copyitem: null, // to store the copied item
		propdata: {}, // a map object to store property data. e.g. {"oid_3": {wsTolerance: 3, kwdlist: []}}
		//kwdListMap:{}, // a map to store keyword list of each argument. key:oid, value:keyword list
		initPropdata: function(oid, argType) {
			_memo.propdata[oid] = {};
			if (argType && argType === _const.list_chip) {
				_memo.propdata[oid].wsTolerance = _const.defatultValue.wsTolerance;
			}
		},
		newOid: function(argType) {
			var newoid = "oid_" + (_memo.oid++);
			_memo.initPropdata(newoid, argType);
			return newoid;
		},
		resetPropdata: function() {
			this.oid = 1;
			this.propdata = {};
		}
	},
	_folder = {
		folderdata: null,
		// create a new folder. return all folder data.
		create : function() {
			var folder = {}, folderdata = this.folderdata, newindex, newname;

			if (!folderdata) {
				folderdata = {};
				folderdata.lastShowFolderIndex = 0;
				folderdata.list = [];
			}
			newindex = folderdata.list.length;
			newname = "Folder " + (newindex + 1);
			folder.name = newname;
			folder.layout = null;
			folder.propdata = {};
			folder.maxoid = 1;
			folderdata.list.push(folder);

			this.save(folderdata);
			this.show(newindex);
			page.helper.clearCanvas();
			this.refreshList();
			return folderdata;
		},
		// delete a folder
		destroy: function(index) {
			var folderdata = this.folderdata, len, nextindex;

			// delete folder
			folderdata.list.splice(index, 1);

			// show next folder
			len = folderdata.list.length; // the length after the folder removed
			if (len > 0) {
				if (index === len){ // removed item is the last one
					nextindex = index - 1; // show previous folder
				} else {
					nextindex = index; // show next folder
				}
				_memo.curFolderIndex = folderdata.lastShowFolderIndex = nextindex;
				this.save(folderdata);
				this.refreshList();
			} else {
				this.create();
			}

			this.show(nextindex);
		},
		// load folder to current environment
		show: function(index) {
			var folderdata = this.folderdata, folder = this.folderdata.list[index];

			if (folder) {
				window.canvasHtml = folder.layout;
				_memo.propdata = folder.propdata;
				_memo.oid = folder.maxoid;
				$("#js_folder_name").html(folder.name);
				//document.title = folder.name;
				if (window.canvasHtml) $(".canvas").html(window.canvasHtml);

				_memo.curFolderIndex = index; // set new created folder as current
				folderdata.lastShowFolderIndex = index;
				this.save(folderdata);

				page.rebindEvents();
				page.initContainer();
			}
		},
		// save data of all folders
		save: function(data) {
			this.folderdata = data;
			if (_save.supportstorage()) {
				localStorage.setItem("folderdata",JSON.stringify(data));
			}
		},
		// clear folder: reset folder data
		clear: function(index) {
			var folder, tIndex;
			if (index && typeof index === "number") {
				tIndex = index;
			} else {
				tIndex = _memo.curFolderIndex;
			}
			folder = this.folderdata.list[tIndex];
			folder.layout = null;
			folder.propdata = {};
			folder.maxoid = 1;
		},
		// refresh folder list in the top drop down list
		refreshList: function() {
			var list = this.folderdata.list;
			var html = list.map(function(value, index) {
				return '<li><a href="#" data-folder-index="' + index + '">' + value.name +'</a></li>';
			});
			$(".js-folders").html(html);
		},
		// rename the current editing folder
		rename: function(index, name) {
			var folder = this.folderdata.list[index];
			folder.name = name;
			this.show(index);
			this.refreshList();
		}
	},
	_save = {
		timerSave: 1000,
		startdrag: 0,
		stopsave: 0,
		supportstorage: function() {
			if (typeof window.localStorage === "object")
				return true;
			else
				return false;
		},
		handleSaveLayout: function() {
			var e = $(".canvas").html();
			if (!_save.stopsave && e != window.canvasHtml) {
				//console.log("saving layout...");
				_save.stopsave++;
				window.canvasHtml = e;
				_save.saveLayout();
				_save.stopsave--;
			}
		},
		saveLayout: function() {
			var data = _folder.folderdata,
				curFolderIndex = _memo.curFolderIndex,
				curfolder;

			if (!data) {
				data = _folder.create();
				curfolder = data.list[0];
			} else {
				data.lastShowFolderIndex = curFolderIndex;
				curfolder = data.list[curFolderIndex];
			}

			curfolder.layout = window.canvasHtml;
			curfolder.propdata = _memo.propdata;
			curfolder.maxoid = _memo.oid;
			if (this.supportstorage()) {
				localStorage.setItem("folderdata",JSON.stringify(data));
			}
			_folder.folderdata = data;
		},
		restoreData: function() {
			var folderdata, lastShowFolderIndex;
			//localStorage.clear();
			//localStorage.removeItem("folderdata");
			if (_save.supportstorage()) {
				folderdata = _folder.folderdata = JSON.parse(localStorage.getItem("folderdata"));
				console.log(folderdata);
				if (!folderdata) folderdata = _folder.create();
				lastShowFolderIndex = folderdata.lastShowFolderIndex;

				_memo.curFolderIndex = lastShowFolderIndex;
				_folder.show(lastShowFolderIndex);
				_folder.refreshList();
			}
		}
	},
	_tool = {
		hasupdate: false, // flag to avoid multiple same update operation.
		setUpateReady: function() { _tool.hasupdate = true; },
		resetUpdate: function() { _tool.hasupdate = false; },
		/*updateItemPanelInfo: function(panelType, info) {
			var $panel = $("#selected_item_panel");

			if (panelType === "copy-panel") $panel = $("#copy_item_panel");
			$panel.find(".js-item").html(info.item);
			$panel.find(".js-oid").html(info.oid);
			$panel.find(".js-about").html(info.about);
		},*/
		// copy an argument to copy board
		copyArg: function(copyOid) {
			var copySource = $(".argument[data-oid=" + copyOid + "]"),
				$copyItem = _memo.copyitem = copySource.clone(); // append copy to memo

			$copyItem.find(".card")
				.removeClass(_const.select_highlight_class)
				.removeClass(_const.copy_highlight_class);
			_tool.highlightArg(copySource, _const.copy_highlight_class);
		},
		// append an argument from copy board to target container
		pasteArg: function(targetOid) {
			if (!targetOid) targetOid = _memo.selected_arg_oid;
			var $copyitem = _memo.copyitem;
			if ($copyitem !== null) {
				var $copy = $copyitem.clone();
				var $targetArg = $(".argument[data-oid=" + targetOid + "]");
				var $childArgs = $copy.find(".argument");
				var $argContainer = $targetArg.find(".arg-container:first");
				var targetArgType = $targetArg.attr("data-arg-type");
				var copyArgType = $copy.attr("data-arg-type");
				//var canvas = "canvas",
				var rule = _const.rule, operator = _const.operator, list = _const.list, list_chip = _const.list_chip;
				var success = false;
				var refoid, $listchip, $toAppendArg, header, headerTitle;

				$copy.attr("data-oid", _memo.newOid());
				$childArgs.each(function() {
					var that = $(this),
						originOid = that.attr("data-oid"),
						originRefoid = that.attr("data-ref-oid"),
						argtype = that.attr("data-arg-type"),
						newoid = _memo.newOid();

					// won't set data-oid attr for upper list argument
					if (argtype !== list) that.attr("data-oid", newoid);
					// for listchip that is generated by dragging instead of copying,
					// we set ref to itself, and copy origin prop to current list
					// 2017/03/30. all lists are reference, won't reset ref oid
					/*if (argtype === list_chip && originOid === originRefoid) {
						that.attr("data-ref-oid", newoid);
						_memo.propdata[newoid] = $.extend({}, _memo.propdata[originOid]);;
					}*/
				});
				if (targetArgType === rule || targetArgType === operator) {
					if (copyArgType === operator || copyArgType === list_chip) {
						if (copyArgType === operator) {
							$toAppendArg = $copy;
						} else {
							$listchip = $copy;
							var $toAppendArg = page.helper.createListArgContainer();
							$toAppendArg.find("ul").append($listchip);

							refoid = $copy.attr("data-ref-oid");
							_memo.propdata[refoid].isorigin = true;
						}

						_tool.appendArg($argContainer, $toAppendArg);
						success = true;
					}
				} else if (targetArgType === list_chip) {
					if (copyArgType === list_chip) {
						//$argContainer = $targetArg.find(".list-arg-container");
						//$listchip = $copy.find(".argument[data-arg-type=ListChip").clone();
						//$argContainer.append($listchip);
						$copy.insertBefore($targetArg);
						refoid = $copy.attr("data-ref-oid");
						_memo.propdata[refoid].isorigin = true;
						success = true;
					}
				} else if (targetOid === _const.canvas_oid) {
					if (copyArgType === rule) {
						header = $copy.find(".header:first");
						headerTitle = header.text();
						header.html(headerTitle + " - copy");
						$(".canvas").append($copy);
						page.helper.rearrangeRulePlaceholder();
						success = true;
					}
				}

				if (success) {
					page.rebindEvents();
				} else {
					page.showNotification("Cannot paste to this argument");
				}
			}
		},
		// append argument to a container
		appendArg: function(argContainer, toAppendArg) {
			var $placeholder = argContainer.find(">.li-placeholder"),
				$thisArg = argContainer.closest(".argument"),
				argLimit, argNum;

			if ($placeholder.length > 0) {
				toAppendArg.insertBefore($placeholder);

				// to keep or remove placeholder based on argument limit
				argLimit = $thisArg.attr("data-arg-limit");
				argNum = argContainer.children(".argument").length;
				if (argNum == argLimit) {
					$placeholder.remove();
				}
			} else {
				page.showNotification("Cannot drop any more argument");
			}
		},
		// update argument info, data is from property panel.
		updateArg: function(oid) {
			if (_tool.hasupdate === false) return;
			if (!oid) oid = _memo.selected_arg_oid;
			if (oid === "oid_0") return;
			var $targetArg = $(".argument[data-oid=" + oid + "]"),
				$propPanel = $(".prop-panel"),
				refoid = $targetArg.attr("data-ref-oid"),
				argType = $targetArg.attr("data-arg-type"),
				argName = $.trim($propPanel.find("#js_arg_name").val()),
				func = $.trim($propPanel.find("#js_func").val()),
				charDistance = $.trim($propPanel.find("#js_char_distance").val()),
				sentDistance = $.trim($propPanel.find("#js_sent_distance").val()),
				score = $.trim($propPanel.find("#js_score").val()),
				wsTolerance = $.trim($propPanel.find("#js_ws_tolerance").val()),
				kwdlist = $.trim($propPanel.find("#js_kwd_list").val());


			if (argType === _const.rule) {
				//$targetArg.attr("data-arg-name", argName);
				$targetArg.attr("data-score", score);
				$targetArg.attr("data-ws-tolerance", wsTolerance);
				$targetArg.find(".header:first").html(argName);
			}
			if (argType === _const.operator) {
				$targetArg.attr("data-func", func);
				$targetArg.find(".header:first").html(func);
				if (_const.operatorFuncs[func].hasDistanceDefine) {
					$targetArg.attr("data-char-distance", charDistance);
					$targetArg.attr("data-sent-distance", sentDistance);
				}
			}
			if (argType === _const.list_chip) {
				//$targetArg.attr("data-arg-name", argName);
				//$targetArg.attr("data-ws-tolerance", wsTolerance);
				_memo.propdata[refoid].wsTolerance = wsTolerance;
				$targetArg.find(".header:first").html(argName);
				if (kwdlist !== "" && refoid) {
					_memo.propdata[refoid].kwdlist = kwdlist.split("\n");
				}

			}
			_tool.resetUpdate();
		},
		// show argument info to property panel
		showArg: function(oid) {
			var $targetArg = $(".argument[data-oid=" + oid + "]"),
				refoid = $targetArg.attr("data-ref-oid"),
				argType = $targetArg.attr("data-arg-type"),
				score = $targetArg.attr("data-score"),
				chardistance = $targetArg.attr("data-char-distance"),
				sentdistance = $targetArg.attr("data-sent-distance"),
				headerTitle = $targetArg.find(".header:first").text(),
				$propPanel = $(".prop-panel"),
				showDistanceParam = false,
				propdata, wsTolerance, kwdlist;

			if (refoid) {
				propdata = _memo.propdata[refoid];
			} else {
				propdata = _memo.propdata[oid];
			}
			wsTolerance = propdata.wsTolerance;
			kwdlist = propdata.kwdlist;

			$propPanel.find("#js_arg_type").html(argType);
			$propPanel.find("#js_score").val(score);
			$propPanel.find("#js_ws_tolerance").val(wsTolerance);
			if (kwdlist) kwdlist = kwdlist.join("\n");
			$propPanel.find("#js_kwd_list").val(kwdlist);

			if (argType === _const.operator) {
				$propPanel.find("#js_char_distance").val(chardistance);
				$propPanel.find("#js_sent_distance").val(sentdistance);
				$propPanel.find(".js-func select").val(headerTitle);
				showDistanceParam = _const.operatorFuncs[headerTitle].hasDistanceDefine;
			} else {
				$propPanel.find("#js_arg_name").val(headerTitle);
			}

			page.helper.toggleProp(argType, showDistanceParam);
		},
		// remove argument from container
		removeArg: function(oid) {
			page.confirm('Are you sure to remove?', function(index){
				var popoverFm = $("#popover_form");
				// var oid = popoverFm.attr("target-oid");
				var $toRemoveArg = $(".argument[data-oid=" + oid + "]");
				var argType = $toRemoveArg.attr("data-arg-type");
				var $parentContainer, $parentArg, $boxListArg, $listArgContainer,
					argNum, argLimit, hasPlaceholder;

				if (argType === _const.list_chip) {
					$listArgContainer = $toRemoveArg.parent();
					$boxListArg = $listArgContainer.parent();
					$parentContainer = $boxListArg.parent();
					// if there is only one list chip left, then will remove the whole box list which include the list arg container.
					if ($listArgContainer.children().length === 1) {
						$boxListArg.remove();
					} else {
						$toRemoveArg.remove();
					}
				} else {
					$parentContainer = $toRemoveArg.parent();
					$toRemoveArg.remove();
				}

				$parentArg = $parentContainer.closest(".argument");
				argLimit = $parentArg.attr("data-arg-limit");
				argNum = $parentContainer.children(".argument").length;
				hasPlaceholder = $parentContainer.children(".li-placeholder").length > 0;

				// we won't add placeholder in canvas when removing a rule;
				// if arg number is less than limit and no placeholder, we add a placeholder to let user continue adding arg.
				if (!$toRemoveArg.hasClass("ly-row") && !hasPlaceholder && argNum < parseInt(argLimit)) {
					page.helper.addArgPlaceHolder($parentContainer);
				}
				// remove list which is not origin. keep any oid which may could be copied.
				//if (_memo.propdata.hasOwnProperty(oid) && _memo.propdata[oid].isorigin !== true) {
				//	delete _memo.propdata[oid];
				//}
				popoverFm.addClass("hide");
			});
		},
		// add highlight effect to argument
		highlightArg: function(argEle, highlightClass) {
			$(".canvas .card").removeClass(highlightClass);
			// $(".canvas .argument").removeClass(highlightClass);
			// argEle.addClass(highlightClass);
			argEle.find(".card:first").removeClass("select-highlight copy-highlight").addClass(highlightClass);
		},
		clearHighlight: function(highlightClass) {
			if (highlightClass) {
				$(".canvas .card").removeClass(highlightClass);
			} else {
				$(".canvas .card").removeClass("select-highlight copy-highlight");
			}			
		},
		// like closest, but down to children, get the close children by condition of the filter
		closestDescendent: function(me, filter) {
			var $found = $(),
				$currentSet = me.children(); // Current place
			while ($currentSet.length) {
				$found = $currentSet.filter(filter);
				if ($found.length) break;  // At least one match: break loop
				// Get all children of the current set
				$currentSet = $currentSet.children();
			}
			//return $found.first(); // Return first match of the collection
			return $found; // Return matched collection
		}
	},
	_render = {
		// to make a keyword in IPOC rule. e.g. Ping An Insurance -> AND/PRE(Ping 3 An 3 Insurance)
		// use {@@} as a blank space holder.
		preserveKwd: function(kwd, wsTolerance) {
			var keyword = $.trim(kwd),
				preserveWord = "{@@}3{@@}";
			if (wsTolerance) preserveWord = "{@@}" + wsTolerance + "{@@}";
			if (keyword.indexOf(" ") > -1) {
				keyword = keyword.replace(/ +/g, " "); // replace multiple blank space " " to a single " "
				keyword = keyword.replace(/ /g, preserveWord);// replace single "" to combine string "{#}"
				keyword = "AND/PRE(" + keyword + ")";
			}
			return keyword;
		},
		// replace {@@} with blank space and add score at the end.
		formatKwd: function(keywordlist, score) {
			for (var i = 0, len = keywordlist.length; i < len; i++) {
				keywordlist[i] = keywordlist[i].replace(/\{@@\}/g, " ") + " " + score;
			}
			return keywordlist;
		},
		// to preserve each keyword in list and concat different chips of a list argument
		// * listData: list array. e.g. [{wsTolerance:3, kwdlist:["aa","bb"]},{wsTolerance:3, kwdlist:["cc","dd"]}]
		concatKwdList: function(listData) {
			var result = [], listChip, preservedList, preserveKwdFunc = this.preserveKwd;

			for (var i = 0, len = listData.length; i < len; i++) {
				listChip = listData[i];
				preservedList = listChip.kwdlist.map(function(value) {
					return preserveKwdFunc(value, listChip.wsTolerance);
				});
				result = result.concat(preservedList);
			}
			return result;
		},
		// unit different list arguments to rule statements.
		// * joinword: could be "", or like "3s2" which is defined for AND/PRE
		unitList: function(argList, joinword) {
			var unit = function(prev, curr, currInd) {
				var result = [];
				var keywordList1 = prev;
				var keywordList2 = _render.concatKwdList(curr);

				// only the first list need to concat, the later prev arguments will be a united list
				if (currInd === 1) keywordList1 = _render.concatKwdList(prev);

				for (var i= 0, len1 = keywordList1.length; i < len1; i++) {
					for (var j= 0, len2 = keywordList2.length; j < len2; j++) {
						result.push(keywordList1[i] + joinword + keywordList2[j]);
					}
				}
				return result;
			};
			if (joinword === "") {
				joinword = "{@@}"
			} else {
				joinword = "{@@}" + joinword + "{@@}";
			}
			return argList.reduce(unit);
		},
		// calculate the combined keyword list of an operator
		// * operator: operator object. e.g. {func: "AND", arguments: [list1, list2, operator]}
		renderOperator: function(operator) {
			var argList = operator.arguments,
				func = operator.func,
				joinword = "", result;

			if (_const.operatorFuncs[func].hasDistanceDefine) {
				joinword = operator.chardistance;
				if (operator.sentdistance !== "") {
					joinword = operator.chardistance + "s" + operator.sentdistance;
				}
			}
			// unite list to rule statements
			result = this.unitList(argList, joinword);
			// add func to statments
			for (var i= 0, len=result.length; i<len; i++) {
				result[i] = operator.func + "(" + result[i] + ")";
			}
			return result;
		},
		renderRuleByOperator: function(operatorData, score) {
			var list =  _render.renderOperator(operatorData);
			list = _render.formatKwd(list, score);
			return list;
		},
		renderRuleByList: function(listData, score) {
			var list = _render.concatKwdList(listData);
			list = _render.formatKwd(list, score);
			return list;
		},
		renderRule: function(argsData, score) {
			if (argsData.func) {
				return _render.renderRuleByOperator(argsData, score);
			} else {
				return _render.renderRuleByList(argsData, score);
			}
		}
	},
	page = {
		initSelectOptions: function() {
			var funcs = _const.operatorFuncs;
			$.each(funcs, function (name, item) {
				$('.js-func-select').append(new Option(name));
			});
		},
		initContainer: function() {
			// enable sortable to get ready to accept .ly-row drag elements
			$(".canvas").sortable({
				opacity: .35,
				items:".argument",
				activeClass: "ui-state-active",
				hoverClass: "ui-state-hover",
				receive: function(ev, ui) {
					var $placeholder = $(this).find(">.rule-placeholder");

					if ($placeholder.length > 0) {
						$placeholder.remove();
						page.helper.addRulePlaceholder();
					}
				},
				start: function(e,t) {
					if (!_save.startdrag) _save.stopsave++;
					_save.startdrag = 1;
				},
				stop: function(ev, ui) {
					$(".arg-container").removeClass("ui-state-active ui-state-hover");
					if(_save.stopsave>0) _save.stopsave--;
					_save.startdrag = 0;
				}
			});

			// Init arg-contianer droppable to get ready to accept drag elements
			page.events.argContainerDroppable();
			// add rule placeholder if there is no one.
			if ($(".canvas").find(">.rule-placeholder").length === 0) {
				page.helper.addRulePlaceholder();
			}
			// restore clicked arguments
			$(".canvas ." + _const.select_highlight_class).each(function() {
				$(this).closest(".argument").click();
				return false;
			});
			// restore copied arguments
			$(".canvas ." + _const.copy_highlight_class).each(function() {
				var oid = $(this).closest(".argument").attr("data-oid");
				_tool.copyArg(oid);
				return false;
			});
		},
		// set limit and scope rank attributes of operator on sidebar.
		updateSidebarOperatorProp: function() {
			//var $argContainer = $(".ly-operator .arg-container");
			var $operator = $(".ly-operator .argument");
			var func = $(".ly-operator select").val();
			var argLimit = _const.operatorFuncs[func].limit;
			var scopeRank = _const.operatorFuncs[func].scopeRank;

			$(".ly-operator .header").html(func);
			$operator.attr("data-func", func);
			$operator.attr("data-arg-limit",argLimit);
			$operator.attr("data-scope-rank",scopeRank);
		},
		helper: {
			clearCanvas: function() {
				$(".canvas").html('');
				page.helper.addRulePlaceholder();
				page.events.switchOnNewArgPanel();
				_memo.resetPropdata();
				//_memo.oid = 1;
				//_memo.propdata = {};
			},
			// add an argument placeholder
			addArgPlaceHolder: function(container) {
				// Get a placeholder copy from row moudle on side bar
				var $placeholder = $(".ly-row .arg-container>li").first().clone();
				container.append($placeholder);
			},
			// put placeholder at then end of all arguments
			rearrangeRulePlaceholder: function() {
				$(".canvas").children(".rule-placeholder").remove();
				page.helper.addRulePlaceholder();
			},
			addRulePlaceholder: function() {
				var $placeholder = $("#rule_placeholder .rule-placeholder").clone();
				$(".canvas").append($placeholder);
			},
			toggleProp: function(argType, toShowCharDistance) {
				var props = _const.propAry[argType],
					$propDivParent = $("#argument_prop>div"),
					propClassName;

				// hide all first
				$("#argument_prop>div>div").addClass("hide");
				$("#argument_prop .js-paste").addClass("hide");

				for (var i= 0,len = props.length; i<len; i++) {
					propClassName = ".js-" + props[i];
					$propDivParent.find(propClassName).removeClass("hide");
				}
				page.helper.toggleCharDistProp(toShowCharDistance);
			},
			// switch on/off of character-distance, sentence-distance property
			toggleCharDistProp: function(toshow) {
				var $propPanel = $("#argument_prop");
				if (toshow) {
					$propPanel.find(".js-char-distance").removeClass("hide");
					$propPanel.find(".js-sent-distance").removeClass("hide");
				} else {
					$propPanel.find(".js-char-distance").addClass("hide");
					$propPanel.find(".js-sent-distance").addClass("hide");
				}
			},
			createListArgContainer: function() {
				//var newOid = ++_memo.oid;
				var $li = $("<li>", {
					"class": "argument box-list",
					"data-arg-type": "List"
					//"data-oid": newOid
				});
				var $argUl = $("<ul>", {"class": "list-arg-container"});
				$li.append($argUl);
				return $li;
			},// update operator type and attributes
			updateOperatorType: function(func, oid) {
				var argLimit = _const.operatorFuncs[func].limit,
					scopeRank = _const.operatorFuncs[func].scopeRank,
				 	$thisArg = $(".argument[data-oid=" + oid + "]"),
					parentOperator = $thisArg.parents(".argument:first"),
					parentFunc = parentOperator.attr("data-func"),
					parentScopeRank = parentOperator.attr("data-scope-rank"),
					$argContainer = $thisArg.find(".arg-container:first"),
					$childArgs = $argContainer.children(".argument"),
					argNum = $childArgs.length,
					withinChildScope = false,
					$placeholder, childScopeRank, childFunc;

				if (argNum <= argLimit) {
					if (scopeRank !== 0) {
						// compare scope rank between this argument and children arguments
						$childArgs.each(function() {
							childScopeRank = $(this).attr("data-scope-rank");
							if (childScopeRank && childScopeRank != 0 && scopeRank < parseInt(childScopeRank)) {
								withinChildScope = true;
								childFunc = $(this).attr("data-func");
								return false;
							}
						});
						if (withinChildScope) {
							page.showNotification("Scope restriction: " + func + " is narrow than its argument: " + childFunc);
							return false;
						}
						// compare scope rank between this argument and parent argument
						if (parentScopeRank && parentScopeRank != 0 && scopeRank > parseInt(parentScopeRank)) {
							page.showNotification("Scope restriction: " + func + " cannot be included to " + parentFunc);
							return false;
						}

					}

					$thisArg.find(".header:first").html(func);
					$thisArg.attr("data-func", func);
					$thisArg.attr("data-arg-limit",argLimit);
					$thisArg.attr("data-scope-rank",scopeRank);
					$placeholder = $argContainer.find(">.li-placeholder");
					page.helper.toggleCharDistProp(_const.operatorFuncs[func].hasDistanceDefine);
					if (argNum < argLimit) {
						if ($placeholder.length === 0) page.helper.addArgPlaceHolder($argContainer);
					} else { // argNum == argLimit
						$placeholder.remove();
					}
				} else {
					page.showNotification("Cannot change: the arguments exceed the limit.<br>Please remove some if you really want to.");
					return true;
				}
				return true;
			},
			// get data of an argument, which could be operator or list.
			//getArgumentData: function(arg, argType, oid) {
			getArgumentData: function(arg) {
				var argsData = null,
					thispage = page,
					argType = arg.attr("data-arg-type"),
					chipsAry = [],
					listChips;
				if (argType === _const.operator) {
					argsData = thispage.helper.getOperatorData(arg);
				} else if (argType === _const.list) {
					listChips = arg.find(".argument");
					listChips.each(function() {
						var refoid = $(this).attr("data-ref-oid"),
							//wsTolerance = $(this).attr("data-ws-tolerance"),
							wsTolerance = _memo.propdata[refoid].wsTolerance,
							kwds = _memo.propdata[refoid].kwdlist,
							chipData = {wsTolerance: wsTolerance, kwdlist: null};

						if (kwds && kwds.length > 0) {
							chipData.kwdlist = kwds;
							chipsAry.push(chipData);
						}
					});
					if (chipsAry.length === 0) {
						thispage.showNotification("No keyword list defined on selected list");
						setTimeout(function() { arg.find(".argument:first").click() }, 300);
					} else {
						argsData = chipsAry;
					}
				}
				return argsData;
			},
			// get data of an operator
			getOperatorData: function getOperatorData($operator) {
				var func = $operator.find(".header:first").text();
				var hasDistanceDefine = _const.operatorFuncs[func].hasDistanceDefine;
				var chardistance = $operator.attr("data-char-distance");
				var sentdistance = $operator.attr("data-sent-distance");
				var data = {func: func, arguments: []};
				var $childArgs = _tool.closestDescendent($operator, ".argument");
				var argLen = $childArgs.length;

				if (argLen < 2) {
					page.showNotification("an operator should have at least 2 arguments");
					setTimeout(function() { $operator.click() }, 300);
					data = null;
				} else {
					if (hasDistanceDefine) {
						if (chardistance === "") chardistance = "*";
						//if (sentdistance === "") sentdistance = "*";
						data.chardistance = chardistance;
						data.sentdistance = sentdistance;
					}
					$childArgs.each(function() {
						var that = $(this);
						var argsData;

						//argsData = page.helper.getArgumentData(that, argType, argOid);
						argsData = page.helper.getArgumentData(that);
						if (argsData === null) {
							data = null;
							return false; // stop iteration of $childrArgs
						} else {
							data.arguments.push(argsData);
						}
					});
				}
				return data;
			}
		},
		events: {
			// make argument container droppable.
			argContainerDroppable: function () {
				$(".arg-container").droppable({
					activeClass: "ui-state-active",
					hoverClass: "ui-state-hover",
					accept: ":not(.ui-sortable-helper)",
					greedy: true,
					tolerance: "intersect",
					start: function(ev, ui) {
						if (!_save.startdrag) _save.stopsave++;
						_save.startdrag = 1;
					},
					stop: function(ev, ui) {
						if(_save.stopsave>0) _save.stopsave--;
						_save.startdrag = 0;
					},
					drop: function (ev, ui) {
						var $targetContainer = $(this), toAppendArg;
						var $containerArg = $targetContainer.closest(".argument");
						var $listChip, newoid;
						//var argType = ui.draggable.attr("data-arg-type");
						//var oid = ui.draggable.attr("data-oid");

						// scope restriction: narrow scope rank can be dropped on wider scope rank.
						if (ui.draggable.hasClass("ly-operator")) {
							var $dragArg = ui.draggable.find(".argument");
							var dragRank = $dragArg.attr("data-scope-rank");
							var dragFunc = $dragArg.attr("data-func");
							var dropRank = $containerArg.attr("data-scope-rank");
							var dropFunc = $containerArg.attr("data-func");

							// if dropRank is valid, means it's an operator, and there is no restriction when scopeRank = 0
							if (dropRank && dragRank != 0 && dropRank != 0 && parseInt(dragRank) > parseInt(dropRank)) {
								page.showNotification("Scope restriction: " + dragFunc + " cannot be dropped in " + dropFunc);
								return false;
							}
						}

						toAppendArg = ui.draggable.find(".module>li").clone();

						// this is a list argument dragged from side bar.
						if (ui.draggable.hasClass("ly-list")) {
							newoid = _memo.newOid(_const.list_chip);
							$listChip = toAppendArg.find(".argument[data-arg-type=ListChip]");
							$listChip.attr("data-oid", newoid);
							$listChip.attr("data-ref-oid", newoid);
						} else {
							// won't set data-oid attr for upper list argument
							toAppendArg.attr("data-oid", _memo.newOid());
						}

						_tool.appendArg($targetContainer, toAppendArg);
						page.rebindEvents();
					}
				});
			},
			argContainerSortable: function() {
				$(".arg-container").sortable({
					cancel: ".fixed",
					// handle: "input",
					opacity: 0.35,
					items: ".argument",
					connectWith: ".arg-container",
					receive: function(ev, ui) {
						// add placeholder to origin sortable container if element dragged out.
						var originArgContainer = ui.sender,
							originPlaceholder = originArgContainer.find(">.li-placeholder");

						if (originPlaceholder.length === 0) {
							page.helper.addArgPlaceHolder(originArgContainer);
						}

						// to put placeholder at then end. if arg num meet the arg limit, then won't add placeholder.
						var $targetContainer = ui.item.parent(),
							$targetArg = $targetContainer.closest(".argument"),
							targetArglimit = $targetArg.attr("data-arg-limit"),
							targetArgnum = $targetContainer.children(".argument").length,
							$placeholder = $targetContainer.find(">.li-placeholder");

						if ($placeholder.length > 0) {
							$placeholder.remove();
							if (targetArgnum < targetArglimit) page.helper.addArgPlaceHolder($(this));
						}

					},
					start: function(ev, ui) {
						if (!_save.startdrag) _save.stopsave++;
						_save.startdrag = 1;
					},
					stop: function(ev, ui) {
						var argType = ui.item.attr("data-arg-type");
						var $targetContainer = ui.item.parent();
						var $targetArg = $targetContainer.closest(".argument"),
							dragArgtype = ui.item.attr("data-arg-type"),
							dragFunc = ui.item.attr("data-func"),
							dragRank = ui.item.attr("data-scope-rank"),
							targetFunc = $targetArg.attr("data-func"),
							targetArglimit = $targetArg.attr("data-arg-limit"),
							targetScopeRank = $targetArg.attr("data-scope-rank"),
							argnum = $targetContainer.children(".argument").length,
							cansort = true;

						// operator cannot be dragged in to list-arg-container
						if (dragArgtype === _const.operator && $targetContainer.hasClass("list-arg-container")) {
							cansort = false;
						}

						// check if arg number exceeded the arg limit.
						if (cansort && argnum > targetArglimit) {
							//$(this).sortable('cancel');
							page.showNotification("Cannot drop any more argument");
							cansort = false;
						} else {
							// check scope rank
							if (ui.item.hasClass('box-operator') && targetScopeRank) {
								if (dragRank != 0 && targetScopeRank != 0 && parseInt(dragRank) > parseInt(targetScopeRank)) {
									page.showNotification("Scope restriction: " + dragFunc + " cannot be dropped in " + targetFunc);
									cansort = false;
								}
							}
						}

						if (!cansort) {
							$(this).sortable('cancel');
						} else {
							// different processing when append list chip argument.
							if (argType === _const.list_chip) {
								// add list-arg-container wrap if a list-chip is moved into an operator
								if ($targetContainer.hasClass("arg-container")) {
									// make list-chip wrap with list-arg-contianer
									var newItem = page.helper.createListArgContainer();
									newItem.find("ul").append(ui.item.clone());
									ui.item.replaceWith(newItem);
								}

								// clear empty list-arg-container which has no any list-chip
								var listArgs = $(this).find(">.box-list");
								listArgs.each(function(index, ele){
									var $that = $(this);
									if ($that.find(">ul").children().length === 0) {
										$that.remove();
									}
								});
							}
						}
						$(".arg-container, .list-arg-container").removeClass("ui-state-active ui-state-hover");
						//page.rebindEvents();
						if(_save.stopsave>0) _save.stopsave--;
						_save.startdrag = 0;
					}
				});
			},
			listArgContainerDroppable: function () {
				$(".list-arg-container").droppable({
					//accept: ".ly-list",
					activeClass: "ui-state-active",
					hoverClass: "ui-state-hover",
					accept: ":not(.ui-sortable-helper), .argument[data-arg-type=ListChip]",
					greedy: true,
					tolerance: "intersect",
					start: function(ev, ui) {
						if (!_save.startdrag) _save.stopsave++;
						_save.startdrag = 1;
					},
					stop: function(ev, ui) {
						if(_save.stopsave>0) _save.stopsave--;
						_save.startdrag = 0;
					},
					drop: function (ev, ui) {
						var newoid, listChip,
							that = $(this);

						// check if there is any list in a list container before dropping.
						// if any, drop the small part, else, drop the larger part with list container.
						// if (that.parent().hasClass("box-list")) { // small part
						newoid = _memo.newOid(_const.list_chip);
						listChip = ui.draggable.find(".argument[data-arg-type=ListChip]").clone();
						listChip.attr("data-oid", newoid);
						listChip.attr("data-ref-oid", newoid);
						that.append(listChip);
						// } else { // larger part with list container
						// 	$li = ui.draggable.find(".module>li").clone()
						// 	$placeholder = that.find(">.li-placeholder");
						// 	$li.insertBefore($placeholder);
						// }
						$(".arg-container, .list-arg-container").removeClass("ui-state-active ui-state-hover");
						page.rebindEvents();
					}

				});
			},
			// show popup box when hover on argument
			hoverOnArgument: function() {
				var timeoutId;
				var positionForm = function(that) {
					var $popoverFm = $("#popover_form");
					var $popDropDown = $popoverFm.find("select");

					// prepare work, set drop down menu value
					if (that.hasClass("box-operator")) {
						$popDropDown.show();
						$popDropDown.val(that.find(".header:first").text());
					} else {
						$popDropDown.hide();
					}
					$popoverFm.attr("target-oid", that.attr("data-oid"));

					// position form
					$popoverFm
						.removeClass('hide')
						.position({
							my: 'right+5 bottom+3',
							at: 'right top',
							of: that,
							collision: 'none',
							within: '.canvas'
						});
				};
				$(".canvas").on("mouseover", ".argument", function(e) {
					var $popoverFm = $("#popover_form");
					var that = $(this);
					if (!timeoutId) {
						if (that.hasClass("ly-row")) {
							// rule row just appear immediately cause popoverform will flash while delay enabled.
							positionForm(that);
						} else {
							timeoutId = window.setTimeout(function() {
								timeoutId = null;
								positionForm(that);
							}, 300);
						}
					}

					// keep form when mouse over pop form
					$popoverFm.on('mouseenter', function () {
						$popoverFm.removeClass('hide');
					});

					// remove form when mouse leave rules
					$(".ly-row").on('mouseout', function () {
						var popoverFm = $("#popover_form");
						popoverFm.addClass('hide');
						if (timeoutId) {
							window.clearTimeout(timeoutId);
							timeoutId = null;
						}
					});
					e.stopPropagation();
				});
			},
			clickArgument: function() {
				$(".canvas .argument").on("click", function(e) {
					// save previous argument data first.
					_tool.setUpateReady();
					_tool.updateArg();

					var that = $(this),
						oid = _memo.selected_arg_oid = that.attr("data-oid");

					_tool.highlightArg(that, _const.select_highlight_class);
					_tool.showArg(oid);
					page.events.switchOnPropPanel();
					e.stopPropagation();
				});
			},
			// switch tab on prop panel
			switchOnPropPanel: function() { $("#navTabs a[href=#argument_prop]").click(); },
			// switch tab on prop panel
			switchOnNewArgPanel: function() { $("#navTabs a[href=#argument_new]").click(); }
		},
		// to refresh events when new object is appended to canvas
		rebindEvents: function () {
			var thispage = page;
			// bindRemoveEvent(); // update remove event to new dragged in elements
			thispage.events.argContainerDroppable();
			thispage.events.argContainerSortable();
			thispage.events.listArgContainerDroppable();
			thispage.events.hoverOnArgument();
			thispage.events.clickArgument();
		},
		eventBinding: function() {
			// dropdown change event of operator in sidebar
			$(".ly-operator select").change(function() {
				page.updateSidebarOperatorProp();
			});

			// drag event of row, comment
			$(".sidebar .ly-row").draggable({
				handle: ".label",			
				cursorAt: { right: -100 },
				opacity: .35,
				zIndex: 999,
				connectToSortable: ".canvas", // drag to canvas will recieve this drag element and jump into the sort list
				appendTo: ".helper-holder",
				helper: "clone",
				drag: function(e, t) {
					t.helper.width(300)
				},
				start: function(ev, ui) {
					var oid = _memo.newOid();
					$(".sidebar .ly-row").attr("data-oid", oid);
					if (!_save.startdrag) _save.stopsave++;
					_save.startdrag = 1;
				},
				stop: function(e, t) {
					$(".sidebar .ly-row").removeAttr("data-oid");
					page.rebindEvents();
					if(_save.stopsave>0) _save.stopsave--;
					_save.startdrag = 0;
				}
			});

			// drag event of operator
			$(".sidebar .ly-operator").draggable({
				handle: ".label",
				cursorAt: { right: 40,top: 30},
				opacity: .45,
				zIndex: 999,
				// connectToSortable: ".arg-container", // if this set, arg-container will receive this drag element
				appendTo: ".helper-holder",
				helper: "clone",
				drag: function(e, t) {
					t.helper.width(150);
				},
				start: function(ev, ui) {
					if (!_save.startdrag) _save.stopsave++;
					_save.startdrag = 1;
				},
				stop: function(e, t) {
					page.rebindEvents();
					if(_save.stopsave>0) _save.stopsave--;
					_save.startdrag = 0;
				}
			});

			// drag event of list
			$(".sidebar .ly-list").draggable({
				handle: ".label",
				cursorAt: { right: 60 },
				opacity: .45,
				zIndex: 999,
				// connectToSortable: ".arg-container", // if this set, arg-container will receive this drag element
				appendTo: ".helper-holder",
				helper: "clone",
				drag: function(e, t) {
					//t.helper.width(200);
				},
				start: function( event, ui ) {
			       $(this).data('preventBehaviour', true);
					if (!_save.startdrag) _save.stopsave++;
					_save.startdrag = 1;
			    },
				stop: function(e, t) {
					page.rebindEvents();
					// t.helper.remove();
					if(_save.stopsave>0) _save.stopsave--;
					_save.startdrag = 0;
				}
			});

			// hover event on item drag-handle in side bar
			$(".sample-arg-list a>span").hover(function() { $(this).toggleClass("label-danger"); });

			$(".js-folders").on("click", "a", function() {
				var index = $(this).data("folder-index");
				_folder.show(index);
			});

			$(".js-newfolder").click(function() {
				_folder.create();
				//layer.msg("New folder has been created.");
			});
			$(".js-destroy").click(function() {
				page.confirm('Are you sure to destroy this folder?', function(){
					_folder.destroy(_memo.curFolderIndex);
				});
			});
			$(".js-rename").click(function() {
				var foldername = _folder.folderdata.list[_memo.curFolderIndex].name;
				layer.prompt({title: "Type a new name", formType: 0, value: foldername}, function(text, index){
					layer.close(index);
					_folder.rename(_memo.curFolderIndex, text);
				});
			});
			// click clear button
			$(".js-clear").click(function() {
				page.confirm('Are you sure to clear?', function(){
					_folder.clear();
					page.helper.clearCanvas();
				});
			});

			// click preview button
			$(".js-preview").click(function() {
				var selectedOid = _memo.selected_arg_oid,
					thispage = page;
				if (selectedOid === "oid_0") {
					thispage.showNotification("No rule selected, please select a rule first.");
					return false;
				}

				var $selectedArg = $(".argument[data-oid=" + selectedOid + "]");
				var $thisRule, score, ruletitle, $childArg, argsData, renderList;

				// select a rule based on any elements in it.
				if ($selectedArg.data("arg-type") !== _const.rule) {
					$thisRule = $selectedArg.closest(".ly-row");
				} else {
					$thisRule = $selectedArg;
				}
				// get rule data.
				score = $thisRule.attr("data-score");
				ruletitle = $thisRule.find(".header:first").text();
				$childArg = _tool.closestDescendent($thisRule, ".argument");
				if ($childArg.length === 0) {
					thispage.showNotification("No arguments defined in rule.");
					return false;
				}
				argsData = thispage.helper.getArgumentData($childArg);
				if (argsData !== null) {
					renderList = _render.renderRule(argsData, score);
					$('#preview_modal textarea').html(renderList.join("\n"));
					$("#preview_modal").removeClass("hide");
					layer.open({
						type: 1,
						title: "Preview (" + ruletitle + ")",
						area: "75%",
						btn: "Close",
						//closeBtn: 2,
						shadeClose: true,
						//skin: 'layui-layer-rim',
						content: $("#preview_modal"),
						end: function() {
							$("#preview_modal").addClass("hide");
						}
					});
					//$("#preview_modal").modal({ backdrop:'static' });
				}
			});

			var updateArgFunc = function() {
				var oid = _memo.selected_arg_oid;
				_tool.setUpateReady();
				_tool.updateArg(oid);
			};

			// click event on popover form
			$("#popover_form").on("click", ".js-copy", function() {
				var oid = $("#popover_form").attr("target-oid");
				_tool.copyArg(oid);
			}).on("click", ".js-paste", function() {
				var oid = $("#popover_form").attr("target-oid");
				_tool.pasteArg(oid);
			}).on("click", ".js-remove", function() {
				var oid = $("#popover_form").attr("target-oid");
				_tool.removeArg(oid);
			}).on("change", ".js-func-select", function() {
				var oid = $("#popover_form").attr("target-oid");
				var $operator = $(".argument[data-oid=" + oid + "]");
				var func = $(this).val();
				var res = page.helper.updateOperatorType(func, oid);
				if (res) {
					$("#argument_prop .js-func-select").val(func);
				} else {
					//restore to previous value
					$(this).val($operator.attr("data-func"));
				}
			});

			 //click event on prop panel
			$("#argument_prop").on("click", ".js-update", updateArgFunc)
			.on("blur", "input, textarea", updateArgFunc)
			.on("click", ".js-paste", function() {
				_tool.pasteArg(_const.canvas_oid);
			}).on("change", "select", function() {
				var oid = _memo.selected_arg_oid;
				var $operator = $(".argument[data-oid=" + oid + "]");
				var func = $(this).val();
				var res = page.helper.updateOperatorType(func, oid);
				if (res === false) {
					//restore to previous value
					$(this).val($operator.attr("data-func"));
				}
			});

			// click the blank area of canvas
			$(".main-panel>.content").click(function() {
				_tool.setUpateReady();
				_tool.updateArg(_const.canvas_oid); // update previous arg data.
				page.helper.toggleProp("Canvas");
				$("#argument_prop #js_arg_type").html("Canvas");
				page.events.switchOnPropPanel();
				_tool.clearHighlight(_const.select_highlight_class);
				_memo.selected_arg_oid = _const.canvas_oid;
			});

			// click tab head on side bar
			$('#navTabs a').click(function (e) {
				e.preventDefault();
				$(this).tab('show')
			});
		},
		confirm: function(msg, yescallback) {
			layer.confirm(msg, {btn: ["yes", "no"], icon: 3, title:'Confirm'}, function(index) {
				yescallback();
				layer.close(index);
			});
		},
		showNotification: function(msg){
			//layer.msg(msg, {offset:['5px', '300px'], icon: 0});
			layer.msg(msg, {
				//offset: "b",//["9px", "200px"],
				icon: 0,
				area: "500px",
				//closeBtn: 1,
				//time: 5000
			});
		},
		init: function() {
			var thispage = page, thesave = _save;
			thesave.restoreData();
			thispage.eventBinding();
			thispage.rebindEvents();
			thispage.initSelectOptions();
			thispage.updateSidebarOperatorProp();
			thispage.initContainer();

			setInterval(function() {
				thesave.handleSaveLayout();
			}, thesave.timerSave);
		}
	};
	$(document).ready(function() {		
		page.init();
	});
})(jQuery);