import { OWGames, OWGamesEvents, OWHotkeys } from "@overwolf/overwolf-api-ts";
import { AppWindow } from "../AppWindow";
import { kHotkeys, kWindowNames, kGamesFeatures } from "../consts";

import WindowState = overwolf.windows.WindowStateEx;

// The window displayed in-game while a game is running.
// It listens to all info events and to the game events listed in the consts.ts file
// and writes them to the relevant log using <pre> tags.
// The window also sets up Ctrl+F as the minimize/restore hotkey.
// Like the background window, it also implements the Singleton design pattern.
class InGame extends AppWindow {
  private static _instance: InGame;
  private _gameEventsListener: OWGamesEvents;
  private _eventsLog: HTMLElement;
  private _infoLog: HTMLElement;
  private knockList: string[];
  private consecutiveDMG: number;
  private clippable: boolean;
  private beamTimer;
  private clipTimer;
  private consecKnocksAndKills: number;

  private constructor() {
    super(kWindowNames.inGame);
    this.knockList = [];
    this.consecutiveDMG = 0;
    this.clippable = false;
    this.beamTimer = setTimeout(() => {
      console.log("Beam timer initiated");
    }, 0);
    this.clipTimer = setTimeout(() => {
      console.log("Clip timer initiated");
    }, 0);
    this.consecKnocksAndKills = 0;
    this._eventsLog = document.getElementById("eventsLog");
    this._infoLog = document.getElementById("infoLog");

    this.setToggleHotkeyBehavior();
    this.setToggleHotkeyText();
    // function checkClip(clippable: boolean, knockList: object): void {
    //   if (clippable) {
    //     console.log("CLIP")
    //     knockList = []
    //   }
    // }
  }

  public static instance() {
    if (!this._instance) {
      this._instance = new InGame();
    }

    return this._instance;
  }

  public async run() {
    const gameClassId = await this.getCurrentGameClassId();

    const gameFeatures = kGamesFeatures.get(gameClassId);

    if (gameFeatures && gameFeatures.length) {
      this._gameEventsListener = new OWGamesEvents(
        {
          onInfoUpdates: this.onInfoUpdates.bind(this),
          onNewEvents: this.onNewEvents.bind(this),
        },
        gameFeatures
      );

      this._gameEventsListener.start();
    }
  }

  private onInfoUpdates(info) {
    this.logLine(this._infoLog, info, false);
  }

  // Special events will be highlighted in the event log
  private onNewEvents(e) {
    const shouldHighlight = e.events.some((event) => {
      switch (event.name) {
        case "kill":
        case "death":
        case "assist":
        case "level":
        case "matchStart":
        case "match_start":
        case "matchEnd":
        case "match_end":
          return true;
      }

      return false;
    });
    // console.log("updating" + JSON.stringify(e));
    console.log("update");

    if ("events" in e) {
      for (let index in e["events"]) {
        let event = e["events"][index];
        if (event["name"] === "damage") {
          const data: object = JSON.parse(event["data"]);
          if (!this.knockList.includes(data["targetName"])) {
            // Check if player is dealing damage to a downed player
            const dmg: number = parseFloat(data["damageAmount"]);
            if (dmg >= 100) {
              // Dealt more than 100 damage in one instance
              this.clippable = true;
              this.resetClipTimer();
            } else {
              // Add damage to running total and start beam timer
              this.consecutiveDMG += dmg;
              console.log("dmg", dmg, this.consecutiveDMG);
              clearTimeout(this.beamTimer);
              this.beamTimer = setTimeout(() => {
                this.clippable = this.consecutiveDMG >= 150 || this.clippable;
                this.consecutiveDMG = 0;
                console.log("beamtrigger");
              }, 2000);
              this.resetClipTimer();
            }
          }
        } else if (event["name"] === "kill_feed") {
          const data = JSON.parse(event["data"]);
          if (
            data["attackerName"] === data["local_player_name"] &&
            !this.knockList.includes(data["victimName"])
          ) {
            console.log("knocked someone");
            this.consecKnocksAndKills += 1;
            this.knockList.push(data["victimName"]);
            if (this.consecKnocksAndKills >= 2) {
              console.log("multknock");
              this.clippable = true;
            }
            this.resetClipTimer();
          }
        }
      }
    }
    console.log("clippable" + this.clippable);
    this.logLine(this._eventsLog, e, shouldHighlight);
  }

  private resetClipTimer() {
    clearTimeout(this.clipTimer);
    this.clipTimer = setTimeout(() => this.checkClip(), 10000);
    console.log("clip timer reset");
  }

  private checkClip() {
    console.log("clip checked");
    if (this.clippable) {
      console.log("CLIP!!!!!!!!");
      overwolf.windows.restore("notification");
      setTimeout(() => {
        overwolf.windows.hide("notification");
      }, 5000);
    }
    this.knockList = [];
    this.clippable = false;
    this.consecKnocksAndKills = 0;
  }
  // Displays the toggle minimize/restore hotkey in the window header
  private async setToggleHotkeyText() {
    const gameClassId = await this.getCurrentGameClassId();
    const hotkeyText = await OWHotkeys.getHotkeyText(
      kHotkeys.toggle,
      gameClassId
    );
    const hotkeyElem = document.getElementById("hotkey");
    hotkeyElem.textContent = hotkeyText;
  }

  // Sets toggleInGameWindow as the behavior for the Ctrl+F hotkey
  private async setToggleHotkeyBehavior() {
    const toggleInGameWindow = async (
      hotkeyResult: overwolf.settings.hotkeys.OnPressedEvent
    ): Promise<void> => {
      console.log(`pressed hotkey for ${hotkeyResult.name}`);
      const inGameState = await this.getWindowState();

      if (
        inGameState.window_state === WindowState.NORMAL ||
        inGameState.window_state === WindowState.MAXIMIZED
      ) {
        this.currWindow.minimize();
      } else if (
        inGameState.window_state === WindowState.MINIMIZED ||
        inGameState.window_state === WindowState.CLOSED
      ) {
        this.currWindow.restore();
      }
    };

    OWHotkeys.onHotkeyDown(kHotkeys.toggle, toggleInGameWindow);
  }

  // Appends a new line to the specified log
  private logLine(log: HTMLElement, data, highlight) {
    const line = document.createElement("pre");
    line.textContent = JSON.stringify(data);
    const clipNotif = document.createElement("pre");
    clipNotif.textContent = "CLIP!";
    clipNotif.className = "highlight";
    // const obj = JSON.parse(JSON.stringify(data));

    // Check if scroll is near bottom
    const shouldAutoScroll =
      log.scrollTop + log.offsetHeight >= log.scrollHeight - 10;

    log.appendChild(line);

    if (shouldAutoScroll) {
      log.scrollTop = log.scrollHeight;
    }
  }

  private async getCurrentGameClassId(): Promise<number | null> {
    const info = await OWGames.getRunningGameInfo();

    return info && info.isRunning && info.classId ? info.classId : null;
  }
}

InGame.instance().run();
