import videojs from 'video.js';
import ResolutionMenuItem from './ResolutionMenuItem';

const MenuButton = videojs.getComponent('MenuButton');

class ResolutionMenuButton extends MenuButton {

  constructor(player, options) {
    super(player, options);
    MenuButton.apply(this, arguments);
  }

  createEl() {
    return videojs.dom.createEl('div', {
      className: 'vjs-http-source-selector vjs-menu-button vjs-menu-button-popup vjs-control vjs-button'
    });
  }

  buildCSSClass() {
    return MenuButton.prototype.buildCSSClass.call(this) + ' vjs-icon-cog';
  }

  update() {
    return MenuButton.prototype.update.call(this);
  }

  createItems() {
    const menuItems = [];
    const levels = [{
      label: 'auto',
      value: 0
    }, ...this.player().resolutions];

    for (let i = 0; i < levels.length; i++) {
      menuItems.push(new ResolutionMenuItem(this.player_, {
        label: levels[i].label,
        value: levels[i].value,
        selected: levels[i].value === this.player().selectedResolution,
        plugin: this.options().plugin,
        streamName: this.options().streamName
      }));
    }

    return menuItems;
  }
}

export default ResolutionMenuButton;
