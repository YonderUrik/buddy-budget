import { ButtonBase } from '@mui/material';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

export default function YearMonthSelection() {
    const monthPopover = usePopover();

  return (
    <>
      <ButtonBase
        onClick={monthPopover.onOpen}
        sx={{
          pl: 1,
          py: 0.5,
          pr: 0.5,
          borderRadius: 1,
          typography: 'subtitle2',
          bgcolor: 'background.neutral',
        }}
      >
        {seriesData}

        <Iconify
          width={16}
          icon={monthPopover.open ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-downward-fill'}
          sx={{ ml: 0.5 }}
        />
      </ButtonBase>
      <CustomPopover open={monthPopover.open} onClose={monthPopover.onClose} sx={{ width: 140 }}>
        <MenuItem
          key="2023"
          selected={option.year === seriesData}
          // onClick={() => handleChangeSeries(option.year)}
        >
          2023
        </MenuItem>
      </CustomPopover>
    </>
  );
}
