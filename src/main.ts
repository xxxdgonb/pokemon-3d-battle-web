import "./styles.css";
import { ThreeBattleRenderer } from "./rendering/ThreeBattleRenderer";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("Application root #app was not found.");
}

const viewport = document.createElement("section");
viewport.className = "battle-viewport";
app.appendChild(viewport);

const renderer = new ThreeBattleRenderer(viewport);
renderer.resize();
renderer.render();

window.addEventListener("resize", () => {
  renderer.resize();
  renderer.render();
});
