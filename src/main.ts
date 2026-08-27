import Phaser from 'phaser';
import './styles/style.css';
import { NeonGameConfig } from './game/config/GameConfig';
import { ui } from './game/ui/UIManager';

ui.init();

new Phaser.Game(NeonGameConfig);
