import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';
import { useCallback, useState } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import { LoadingButton } from '@mui/lab';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import ListItemText from '@mui/material/ListItemText';
import Badge, { badgeClasses } from '@mui/material/Badge';
import TableContainer from '@mui/material/TableContainer';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { useBoolean } from 'src/hooks/use-boolean';

import axios from 'src/utils/axios';
import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import EmptyContent from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import { TableHeadCustom, useTable, getComparator } from 'src/components/table';

// ----------------------------------------------------------------------

export default function BankingRecentTransitions({
  title,
  subheader,
  tableLabels,
  tableData,
  isLoading,
  categories,
  refreshBanks,
  refreshTransactions,
  ...other
}) {
  return (
    <Card {...other}>
      <CardHeader title={title} subheader={subheader} sx={{ mb: 3 }} />

      <TableContainer sx={{ overflow: 'unset' }}>
        <Scrollbar>
          <Table sx={{ minWidth: 720 }}>
            <TableHeadCustom headLabel={tableLabels} />
            <TableBody sx={{ maxHeight: 800 }}>
              {isLoading || !categories ? (
                <TableRow>
                  <LinearProgress />
                </TableRow>
              ) : (
                <>
                  {tableData.map((row) => (
                    <BankingRecentTransitionsRow
                      refreshBanks={() => refreshBanks()}
                      refreshTransactions={() => refreshTransactions()}
                      categories={categories}
                      key={row._id}
                      row={row}
                    />
                  ))}

                  {tableData.length === 0 && (
                    <TableRow>
                      <EmptyContent sx={{ mb: 2 }} title="No data" />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </Scrollbar>
      </TableContainer>

      <Divider sx={{ borderStyle: 'dashed' }} />
    </Card>
  );
}

BankingRecentTransitions.propTypes = {
  subheader: PropTypes.string,
  tableData: PropTypes.array,
  isLoading: PropTypes.bool,
  categories: PropTypes.object,
  tableLabels: PropTypes.array,
  refreshBanks: PropTypes.func,
  refreshTransactions: PropTypes.func,
  title: PropTypes.string,
};

// ----------------------------------------------------------------------

function BankingRecentTransitionsRow({ row, categories, refreshBanks, refreshTransactions }) {
  const { enqueueSnackbar } = useSnackbar();
  const dialog = useBoolean();

  let categoryObject = {};
  let subcategory = {};

  if (row.type !== 'transfer') {
    categoryObject = categories[row.type].find((item) => item.category_id === row.categoryId);
    subcategory = categoryObject.subcategories.find(
      (sub) => sub.subcategory_id === row.subCategoryId
    );
  }
  const popover = usePopover();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await axios.post('/api/banking/delete-transaction', { id: row._id });
      enqueueSnackbar('Transaction deleted');
      refreshBanks();
      refreshTransactions();
      popover.onClose();
    } catch (error) {
      enqueueSnackbar(error.message || error, { variant: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderTypeCell = () => {
    let color = '';
    let icon = '';
    let text = '';
    if (row.type === 'in') {
      color = 'success';
      icon = 'mdi:cash-plus';
      text = 'Income';
    } else if (row.type === 'out') {
      color = 'error';
      icon = 'mdi:cash-minus';
      text = 'Expense';
    } else {
      color = 'info';
      icon = 'solar:card-transfer-bold';
      text = 'Transfer';
    }

    return (
      <Stack alignContent="center" alignItems="center" direction="row">
        <Badge
          overlap="circular"
          color={color}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          badgeContent={<Iconify icon={icon} width={16} />}
          sx={{
            [`& .${badgeClasses.badge}`]: {
              p: 0,
              width: 20,
            },
          }}
        />
        <Typography sx={{ ml: 2 }} variant="subtitle2">
          {text}
        </Typography>
      </Stack>
    );
  };

  return (
    <>
      <TableRow>
        {/* BANK ACCOUNT */}
        <TableCell sx={{ py: 0 }}>
          <ListItemText primary={row.cardName} secondary={row?.cardNameTo} />
        </TableCell>

        {/* DATE CELL */}
        <TableCell sx={{ py: 0 }}>
          <ListItemText primary={fDate(row.date) || row.date} />
        </TableCell>

        {/* AMOUNT CELL */}
        <TableCell sx={{ py: 0 }}>{fCurrency(row.amount)}</TableCell>

        {/* TYPE CELL */}
        <TableCell sx={{ py: 0 }}>{renderTypeCell()}</TableCell>

        {/* CATEGORY / SUBCATEGORY CELL */}
        <TableCell sx={{ display: 'flex', alignItems: 'center', py: 0 }}>
          <ListItemText
            primary={categoryObject.category_name}
            secondary={subcategory.subcategory_name}
          />
        </TableCell>

        <TableCell align="right" sx={{ pr: 1, py: 0 }}>
          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 160 }}
      >
        <MenuItem onClick={dialog.onTrue} sx={{ color: 'error.main' }}>
          <Iconify icon="solar:trash-bin-trash-bold" />
          Delete
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={dialog.value}
        onClose={dialog.onFalse}
        title="Delete transaction"
        content="Are you sure want to delete this transaction?"
        action={
          <LoadingButton
            loading={isDeleting}
            variant="contained"
            color="error"
            onClick={handleDelete}
          >
            Delete
          </LoadingButton>
        }
      />
    </>
  );
}

BankingRecentTransitionsRow.propTypes = {
  row: PropTypes.object,
  categories: PropTypes.object,
  refreshBanks: PropTypes.func,
  refreshTransactions: PropTypes.func,
};
