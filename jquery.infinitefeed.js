// ### Infinite Feed plugin ###
// Infinite feed in a small abstraction for showing feeds. It comes with a infinite scrolling and loading management.
// jQuery, [underscore.js](http://documentcloud.github.com/underscore/) and [jscrollpane](http://jscrollpane.kelvinluck.com/) are required.
// make sure to use proper css for the selector to accomodate jscrollpane, e.g.:

// >> width: 100%;
// >> height: 200px;
// >> overflow: auto;

// Tested on IE6+, FF 3.6, FF 6, Safari and Chrome

// Infinite feed has this options:

// Required:
// - **url**: URL of the feed.
// - **requestType**: json, jsonp, etc.
// - **tmpl**: function recieving a feed item and returning html.

// Optional:
// - **header**: jQuery object or html as string, appears before the feed items.
// - **timer**: time in seconds between requests for updated content. *Default*: 60 seconds.
// - **firstTimeHook**: function. called with the elements selected and the data recieved.

// - **firstLoading**: this function gets called on the first loading.
// - **newLoading**: jQuery object or HTML of the loading that's added on top or on bottom of the feed whenever new items are fetched.
// - **loadingClass**: the selector of the loading elements. defaults to 'loading'.

// - **timestamp**: the time attribute of the feed item.
// - **id**: the id attribute of the feed item.
// - **loadMoreRequest**:  ha
// - **getItems**: 
// - **footer**: jQuery object or HTML as string, appears after the feed item.
// - **notifyOnNewItems**: called when the feed is updating with new items, recieves the storage object. The storage object has three elements. **elem** is the feed item recieved in the call. **id** and **timestamp**.

// API:
// 

// Note that using infiniteFeed on several elements, e.g. $(".class") will result in a separate JSON request for each feed.

(function($) {
	$.fn.infiniteFeed = function(options) {
		var defaults = {
			header: false,
			timer: 60,
			loadingClass: '.loading',
			firstTimeHook: function() { return; },
			footer: false,
			loadMoreRequest: false,
		}
  		var options = $.extend(defaults, options);
		
		return this.each(function() {
			var e = $(this);
			
			// Each element in storage has id, timestamp and elem as the item itself.
			var storage = [];
			
			// There are two options. True indicates we are checking for newer items.
			var loadingPastItems = false;
			
			// stores the jscrollpane api
			var jsp = false;
			
			function isInStorage(item) {
				return _.any(storage, function(i) {
					return i.id == item[options.id];
				});
			}
			
			function getItem(id) {
				return _.detect(storage, function(i) {
					return i.id == id;
				});
			}
			
			function getLastItem(key) {	
				return _.min(storage, function(i) {
					return i.timestamp
				}).elem[key];
			}
			
			// create an api
			e.data('feed', {
				isInStorage: isInStorage,
				getItem: getItem
			});
			
			// We start with adding loading.
			options.firstLoading(e);
			
			// We enter an infinite loop with no escaping.
			// First we establish grounds by calling generateFeed once.
			// Inside generateFeed, from the json request callback, we call loop.
			generateFeed();
			
			// loop() is used because we are doing some async jobs inside the timeout
			// and we don't want them to queue up, do we? (at least, that's [MDC's](https://developer.mozilla.org/En/window.setInterval) advice.
			// I hope this won't reach max recurse. See also [this](http://stackoverflow.com/questions/6888409/settimeout-for-xhr-requests/6888436#6888436).
			function loop() {
				setTimeout(generateFeed, options.timer * 1000);
			};
			
			// Here's the beef we've all been waiting for.
			// Note that loadingPastItems is used through out to check if the request
			// is for pagination or an update.
			function generateFeed(paginationData) {
                                                
				
				var data = {};
				// add pagination data if needed
				if (loadingPastItems) {
					if (storage.length <= options.maxItems) {
						data[paginationData.key] = getLastItem(paginationData.val);
					} else {
						// there's no need for more updates, return
						loadingPastItems = false;
						if (! jsp.getContentPane().find('.feed-end').length) {
							jsp.getContentPane().append("<span class='feed-end'>" + paginationData.message + "</span>");
							jsp.reinitialise();	
						}
						return;
					}
				}
				
				// won't happen on the first run
				if (storage.length) {
					// pagination or update?
					if (loadingPastItems) {
						e.append(options.newLoading);
					} else {
						e.find('.feed-items').before(options.newLoading);
					}
				}
				
				$.ajax(options.url, {data: data, dataType: options.requestType, success: function(d) {
					e.find(options.loadingClass).remove();

					// First time: adding the header and calling the hook
					if (_.isEmpty(storage)) {
						e.append(
							(options.header ? "<div class='feed-header'>" + options.header + "</div>" : '')
							+ "<div class='feed-items'></div>"
							+ (options.footer ? "<div class='feed-footer'>" + options.footer + "</div>" : '')
						);
						
						options.firstTimeHook(e,d); // call the hook, passing the element & data

						// start scrolling plugin, and store its api
						jsp = $("#" + e.attr('id') + " > .feed-items").bind(
							'jsp-scroll-y', function(e, scrollPositionY, isAtTop, isAtBottom) {
								if (options.loadMoreRequest && jsp.getPercentScrolledY() == 1) {
									if (loadingPastItems) return;
									loadingPastItems = true;
									generateFeed(options.loadMoreRequest);
								}
							})
							.jScrollPane().data('jsp');
					}

					// iterate over the children children
					if (options.getItems != undefined)
						d = options.getItems(d);
					
					var items_html = '';
					var flagNewItems = 0;
					$.each(d, function(i, item) {
						if (! isInStorage(item)) {
							storage.push({
								id: item[options.id],
								timestamp: new Date(item[options.timestamp]).getTime(),
								elem: item
							});
							flagNewItems += 1;
							
							items_html += options.tmpl(item);
						}
					});
					if (flagNewItems && $.isFunction(options.notifyOnNewItems)) options.notifyOnNewItems(storage.slice(storage.length - flagNewItems - 1));
					
					// decide whether to add them at the bottom or at the top
					if (loadingPastItems) {
						jsp.getContentPane().append(items_html);
					} else {
						var s = $(items_html);
						jsp.getContentPane().prepend(s);
						// TODO: add notification on new items.
					}
					
					// re-init jsp
					jsp.reinitialise();

					// here we go again, unless it was a pagination call
					(loadingPastItems || ! options.timer) ? loadingPastItems = false : loop();
				}});
			}
		});
	}
})(jQuery)
