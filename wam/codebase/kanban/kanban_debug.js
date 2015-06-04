/*
@license
webix UI v.2.4.0
This software is covered by Webix Trial License.
Usage without proper license is prohibited.
(c) XB Software Ltd.
*/
webix.protoUI({
	name:"kanban",
	$init:function(){
		this.data.provideApi(this, true);
		this._applyOrder();
		this.$ready.push(function(){
			this._sublist = this._buildSublistMap(this, {});
		});

	},
	_applyOrder: function(){
		this.data.attachEvent("onStoreUpdated",function(id){
			var statusArr = {};
			this.each(function(item){
				if(item.status){
					if(!statusArr[item.status]){
						statusArr[item.status] = [];
					}
					statusArr[item.status].push(item);
				}
			});

			for(var status in statusArr){

				var arr = statusArr[status];
				arr.sort(function(a,b){
					var i = a.$index;
					var j = b.$index;
					if(i == j){
						return a.id == id?-1:(b.id == id?1:0);
					}
					return i>j?1:(i<j?-1:0);
				});
				for(var i =0; i< arr.length;i++){
					arr[i].$index = i;
				}
			}
		});
	},
	_buildSublistMap:function(view, hash){
		var t = view.getChildViews();
		for (var i = 0; i < t.length; i++) {
			var sub = t[i];
			if (sub.$kanban){
				var status = sub.config.status;
				hash[status] = sub;
				if (this.config.icons)
					sub.type.icons = this.config.icons;
				sub.config.master = this.config.id;
				sub.sync(this.data, this._getSublistFilter(status));
			} else if (sub.getChildViews)
				this._buildSublistMap(sub, hash);
		}
		return hash;
	},
	_getSublistFilter:function(status){
		return function(){
			this.filter(function(item){
				return item.status == status;
			});
			this.sort(function(a,b){
				a = a.$index;
				b = b.$index;
				return a>b?1:(a<b?-1:0);
			});
		};
	},
	getSelectedId:function(){
		var selected = null;
		this.eachList(function(list){ selected = list.getSelectedId() || selected; });
		return selected;
	},
	select:function(id){
		this.getOwnerList(id).select(id);
	},
	getOwnerList:function(id){
		var owner = null;
		this.eachList(function(list){if (list.data.order.find(id)>-1) owner = list; });
		return owner;
	},
	eachList:function(code){
		for (var key in this._sublist)
			code.call(this, webix.$$(this._sublist[key]), key);
	},
	_unmarkList: function(){
		if(this._markedListId){
			var list = webix.$$(this._markedListId);
			webix.html.removeCss(list.$view, "webix_drag_over");
		}
	},
	_markList: function(list){
		this._unmarkList();
		if(list.$view.className.indexOf("webix_drag_over")<0){
			webix.html.addCss(list.$view, "webix_drag_over");
		this._markedListId = list.config.id;
	}

}
}, webix.DataLoader, webix.EventSystem, webix.ui.headerlayout);


webix.protoUI({
	name:"kanbanlist",
	$init:function(){
		this.$view.className += " webix_kanban_list";
		this.attachEvent("onAfterSelect", function(){
			this.eachOtherList(function(list){
				list.unselect();
			});
		});
		this.$ready.push(webix.bind(this._setHandlers,this));
	},
	$kanban:true,
	on_context:{},
	$dragDestroy: function(){
		webix.$$(this.config.master)._unmarkList();
		webix.html.remove(webix.DragControl._html);
	},
	_setHandlers: function(){

		this.on_click["webix_kanban_user_avatar"] = function(e,id,none){
			return webix.$$(this.config.master).callEvent("onAvatarClick",[id,e,none,this]);
		};

		// selection events
		this.attachEvent("onBeforeSelect",function(id,state){
			return  webix.$$(this.config.master).callEvent("onListBeforeSelect", [id,state,this]);
		});
		this.attachEvent("onAfterSelect",function(id){
			webix.$$(this.config.master).callEvent("onListAfterSelect", [id,this]);
		});

		// click event
		this.attachEvent("onItemClick",function(id,e,node){
			var target = e.target||e.srcElement;
			var icon = null;
			while(!icon && target!=node){
				icon = target.getAttribute("webix_icon_id");
				target = target.parentNode;
			}
			var res = true;
			if(icon)
				res = res&&webix.$$(this.config.master).callEvent("onListIconClick", [icon,id,e,node,this]);
			if(res)
				webix.$$(this.config.master).callEvent("onListItemClick", [id,e,node,this]);
		});

		// dblclick event
		this.attachEvent("onItemDblClick",function(id,e,node){
			webix.$$(this.config.master).callEvent("onListItemDblClick", [id,e,node,this]);
		});

		// context events
		this.attachEvent("onBeforeContextMenu",function(id,e,node){
			return webix.$$(this.config.master).callEvent("onListBeforeContextMenu", [id,e,node,this]);
		});
		this.attachEvent("onAfterContextMenu",function(id,e,node){
			webix.$$(this.config.master).callEvent("onListAfterContextMenu", [id,e,node,this]);
		});


		// drag-n-drop events
		this.attachEvent("onBeforeDrag", function(context,e){
			return  webix.$$(this.config.master).callEvent("onListBeforeDrag", [context,e,this]);
		});

		this.attachEvent("onBeforeDragIn", function(context,e){
			var kanban = webix.$$(this.config.master);
			var result = kanban.callEvent("onListBeforeDragIn", [context,e,this]);
			kanban._unmarkList();
			if(result){
				if(!context.target)
					kanban._markList(this);

			}

			return result;
		});

		this.attachEvent("onDragOut", function(context,e){
			webix.$$(this.config.master).callEvent("onListDragOut", [context,e,this]);
		});

		this.dropHandler = this.attachEvent("onBeforeDrop", function(context,e){
			var kanban = webix.$$(this.config.master);
			kanban._unmarkList();
			if(kanban.callEvent("onListBeforeDrop",[context,e,this])){
				var id = context.start;
				var item = kanban.getItem(id);
				item.$index = context.index;
				if(context.from != context.to){
					if(kanban.callEvent("onBeforeStatusChange", [id,this.config.status,this,context,e])){
						item.status = this.config.status;
						kanban.updateItem(id);
						kanban.callEvent("onAfterStatusChange", [id,this.config.status,this,context,e]);
						kanban.callEvent("onListAfterDrop",[context,e,this]);
					}
					return false;
				}
				// to call onStoreUpdated handler
				kanban.refresh(id);

				kanban.callEvent("onListAfterDrop",[context,e,this]);
				return true;
			}
			return false;
		});
	},
	$dragCreate: function(a,e){
		var text = webix.DragControl.$drag(a,e);
		if (!text) return false;
		var drag_container = document.createElement("DIV");
		drag_container.innerHTML=text;
		drag_container.className="webix_drag_zone webix_kanban_drag_zone";
		document.body.appendChild(drag_container);
		return drag_container;
	},
	$dragPos: function(pos){
		pos.x = pos.x - 4;
		pos.y = pos.y - 4;
	},
	eachOtherList:function(code){
		var self = this.config.id;
		var master = webix.$$(this.config.master);

		master.eachList(function(view){
			if (view.config.id != self)
				code.call(webix.$$(self), view);
		});
	},
	type_setter: function(type){
		var i= 0, icon=null;
		var t = webix.ui.dataview.prototype.type_setter.apply(this, arguments);
		if(this.type.icons){
			for (i = 0; i < this.type.icons.length; i++){
				icon =  this.type.icons[i];
				if(icon.click){
					this.on_click['fa-'+icon.icon] = icon.click;
				}
			}
		}
		return t;
	},
	defaults:{
		drag:true,
		prerender:true,
		select:true,
		xCount: 1

	},
	type:{
		height:"auto",
		width: "auto",
		icons:[
			{ icon:"pencil" }
		],
		tagDemiliter: ",",
		templateTags: function(obj,common){
			var res = [];
			if(obj.tags){
				var tags = obj.tags.split(common.tagDemiliter);
				for (var i = 0; i < tags.length; i++){
					res.push('<span class="webix_kanban_tag">'+tags[i]+'</span>');
				}
			}
			return '<div  class="webix_kanban_tags">' +(res.length?res.join(' '):"&nbsp;")+'</div>';
		},
		templateIcons: function(obj,common){
			var icons = [];
			var icon = null;
			var html = "";
			for (var i = 0; i < common.icons.length; i++){
				icon = common.icons[i];
				if(!icon.show || icon.show(obj)){
					var html = '<span webix_icon_id="'+(icon.id||icon.icon)+'" class="webix_kanban_icon" title="'+(icon.tooltip||'')+'">';

					html += '<span class="fa-'+icon.icon+' webix_icon"></span>';


					if(icon.template){
						html += '<span class="webix_kanban_icon_text">'+webix.template(icon.template)(obj)+'</span>';
					}
					html += '</span>';
					icons.push(html);
				}
			}
			return '<div  class="webix_kanban_icons">' +icons.join(" ")+'</div>';
		},
		templateNoAvatar: webix.template("<span class='webix_icon fa-user'></span>"),
		templateAvatar: webix.template(""),
		templateBody: webix.template("#text#"),
		templateFooter: function(obj,common){
			var tags = common.templateTags(obj,common);
			return (tags?tags:"&nbsp;")+ common.templateIcons(obj,common);
		},
		templateStart:webix.template('<div webix_f_id="#id#" class="{common.classname()} webix_kanban_list_item" style="width:{common.width}px; height:{common.height}px;   overflow:hidden;float:left;">'),
		template:function(obj, common){
			//var img = (obj.img)?"<img src='"+obj.img+"'/>":"";
			var avatarResult = common.templateAvatar(obj,common);
			var avatar = '<div class="webix_kanban_user_avatar">'+(avatarResult?avatarResult:common.templateNoAvatar(obj,common))+'</div>';
			var body = '<div class="webix_kanban_body">'+common.templateBody(obj,common)+'</div>';
			var footer = '<div class="webix_kanban_footer">'+common.templateFooter.call(this,obj,common)+ '</div>';
			var style = "border-left-color:"+obj.color;
			return avatar+'<div class="webix_kanban_list_content" style="'+style+'">'+body+footer+'</div>';
		}
	}
}, webix.ui.dataview);