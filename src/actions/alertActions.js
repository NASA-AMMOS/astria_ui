export const showAlert = ({
  title,
  message,
  primaryAction,
  secondaryAction,
  primaryActionLabel = 'Dismiss',
  secondaryActionLabel = 'Support',
  onDismiss,
  escapable,
}) => {
  return {
    type: 'SHOW_ALERT',
    title,
    message,
    primaryAction,
    secondaryAction,
    primaryActionLabel,
    secondaryActionLabel,
    onDismiss,
    escapable,
    hasSecondaryAction: !!secondaryAction,
  };
};

export const hideAlert = () => {
  return { type: 'HIDE_ALERT' };
};

export function doPrimaryAction() {
  return (dispatch, getState) =>
    new Promise((resolve) => {
      const { alert } = getState();
      if (alert.primaryAction) alert.primaryAction();
      dispatch(hideAlert());
      resolve();
    });
}

export function doSecondaryAction() {
  return (dispatch, getState) =>
    new Promise((resolve) => {
      const { alert } = getState();
      if (alert.secondaryAction) alert.secondaryAction();
      dispatch(hideAlert());
      resolve();
    });
}
