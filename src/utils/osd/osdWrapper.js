import { OSDViewerManager } from './osdViewer';
import { OSDFabricMixin } from './osdFabric';
import { OSDAnnotateMixin } from './osdAnnotate';
import { OSDImageFeatureMixin } from './osdImageFeature';
import { OSDMeasureMixin } from './osdMeasure';
import { OSDTargetMixin } from './osdTargets';
import { OSDScalebarMixin } from './osdScalebar';
import { OSDDataCursorMixin } from './osdDataCursor';
import { OSDAzElRulersMixin } from './osdAzElRulers';
import { OSDExportMixin } from './osdExport';
import { OSDMiscMixin } from './osdMisc';
import { OSDProgressMixin } from './osdProgress';
import { OSDFootprintsMixin } from './osdFootprints';

// don't include scalebar because that can't be exported in its current form
export const OSDWrapperNoExport = OSDMiscMixin(
  OSDAzElRulersMixin(
    OSDTargetMixin(
      OSDMeasureMixin(
        OSDFootprintsMixin(
          OSDImageFeatureMixin(OSDAnnotateMixin(OSDDataCursorMixin(OSDFabricMixin(OSDProgressMixin(OSDViewerManager)))))
        )
      )
    )
  )
);

export const OSDWrapper = OSDExportMixin(OSDScalebarMixin(OSDWrapperNoExport));

export default OSDWrapper;
