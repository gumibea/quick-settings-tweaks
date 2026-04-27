import GObject from "gi://GObject"
import {
    type SystemIndicator,
} from "resource:///org/gnome/shell/ui/quickSettings.js"

/** GNOME 48: extension DnD; GNOME 49: shell `ui/status/doNotDisturb.js` */
export const DND_INDICATOR_GTYPES = new Set([
	"Gjs_toggle_dndQuickToggle_DndIndicator",
	"Gjs_status_doNotDisturb_Indicator",
])

export interface SystemIndicatorOrderItem {
    gtypeName?: string
    constructorName?: string
    friendlyName?: string
    nonOrdered?: boolean
    isSystem?: boolean
    hide?: boolean
}
export namespace SystemIndicatorOrderItem {
    export function match(a: SystemIndicatorOrderItem, b: SystemIndicatorOrderItem) {
        if (
            a.isSystem != b.isSystem
            || a.nonOrdered != b.nonOrdered
            || a.hide != b.hide
        ) return false
        if (a.nonOrdered) return true
        if (a.isSystem) return a.gtypeName == b.gtypeName
        return (
            a.constructorName == b.constructorName
            && a.friendlyName == b.friendlyName
            && a.gtypeName == b.gtypeName
        )
    }
    export function indicatorMatch(item: SystemIndicatorOrderItem, indicator: SystemIndicator): boolean {
        if (item.nonOrdered) return false
        if (item.gtypeName) {
			const t = GObject.type_name_from_instance(indicator as any)
			const orderIsDnd = DND_INDICATOR_GTYPES.has(item.gtypeName)
			const indIsDnd = DND_INDICATOR_GTYPES.has(t)
			if (orderIsDnd) {
				if (!indIsDnd) return false
			} else if (t != item.gtypeName) {
				return false
			}
		}
        if (item.constructorName && indicator.constructor.name != item.constructorName)
            return false
        return true
    }
    export const Default: SystemIndicatorOrderItem = {
        hide: false,
        constructorName: "",
        friendlyName: "",
        gtypeName: "",
    }
    export function create(friendlyName: string): SystemIndicatorOrderItem {
        return {
            ...Default,
            friendlyName,
        }
    }
}
