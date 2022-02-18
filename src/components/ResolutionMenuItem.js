import videojs from 'video.js';
const MenuItem = videojs.getComponent('MenuItem');
const Component = videojs.getComponent('Component');

class ResolutionMenuItem extends MenuItem {

  constructor(player, options) {
    options.selectable = true;
    options.multiSelectable = false;
    super(player, options);
  }

  handleClick() {
    this.options().plugin.changeStreamQuality(this.options().value);
  }

}

Component.registerComponent('ResolutionMenuItem', ResolutionMenuItem);
export default ResolutionMenuItem;
