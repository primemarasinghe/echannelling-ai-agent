import BodyMapImage from './BodyMapImage'

export interface BodyFocus {
  view: 'front' | 'back'
  zoom: number
  cy: number  // SVG y-coordinate to centre on (0–1500)
}

export type BodyRegion =
  | 'head-right' | 'head-left'
  | 'neck'
  | 'right-shoulder' | 'left-shoulder'
  | 'chest-right'    | 'chest-left'
  | 'abdomen'
  | 'upper-back-right' | 'upper-back-left'
  | 'lower-back'
  | 'right-arm'  | 'left-arm'
  | 'right-hand' | 'left-hand'
  | 'right-hip'  | 'left-hip'
  | 'right-leg'  | 'left-leg'

interface RegionMeta {
  id: BodyRegion
  label: string
  si: string
  views: ('front' | 'back')[]
}

export const REGION_META: RegionMeta[] = [
  { id: 'head-right',       label: 'Head Right',       si: 'දකුණු ඔළුව',        views: ['front','back'] },
  { id: 'head-left',        label: 'Head Left',        si: 'වම් ඔළුව',          views: ['front','back'] },
  { id: 'neck',             label: 'Neck',             si: 'බෙල්ල',             views: ['front','back'] },
  { id: 'right-shoulder',   label: 'Right Shoulder',   si: 'දකුණු උරහිස',       views: ['front','back'] },
  { id: 'left-shoulder',    label: 'Left Shoulder',    si: 'වම් උරහිස',         views: ['front','back'] },
  { id: 'chest-right',      label: 'Right Chest',      si: 'දකුණු පපුව',        views: ['front']        },
  { id: 'chest-left',       label: 'Left Chest',       si: 'වම් පපුව',          views: ['front']        },
  { id: 'abdomen',          label: 'Abdomen',          si: 'බඩ',                views: ['front']        },
  { id: 'upper-back-right', label: 'Upper Back Right', si: 'දකුණු ඉහළ කොන්ද',  views: ['back']         },
  { id: 'upper-back-left',  label: 'Upper Back Left',  si: 'වම් ඉහළ කොන්ද',    views: ['back']         },
  { id: 'lower-back',       label: 'Lower Back',       si: 'කොඳු ඇටේ',          views: ['back']         },
  { id: 'right-arm',        label: 'Right Arm',        si: 'දකුණු අත',          views: ['front','back'] },
  { id: 'left-arm',         label: 'Left Arm',         si: 'වම් අත',            views: ['front','back'] },
  { id: 'right-hand',       label: 'Right Hand',       si: 'දකුණු අත (ලේ)',     views: ['front','back'] },
  { id: 'left-hand',        label: 'Left Hand',        si: 'වම් අත (ලේ)',       views: ['front','back'] },
  { id: 'right-hip',        label: 'Right Hip',        si: 'දකුණු කලව',         views: ['front','back'] },
  { id: 'left-hip',         label: 'Left Hip',         si: 'වම් කලව',           views: ['front','back'] },
  { id: 'right-leg',        label: 'Right Leg',        si: 'දකුණු කකුල',        views: ['front','back'] },
  { id: 'left-leg',         label: 'Left Leg',         si: 'වම් කකුල',          views: ['front','back'] },
]

interface Props {
  selected: BodyRegion[]
  onToggle: (r: BodyRegion) => void
  focus?: BodyFocus
}

export default function BodyMap({ selected, onToggle, focus }: Props) {
  return <BodyMapImage selected={selected} onToggle={onToggle} focus={focus} />
}
