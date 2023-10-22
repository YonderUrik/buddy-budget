import { format } from 'date-fns';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import { useTheme } from '@mui/material/styles';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import ListItemText from '@mui/material/ListItemText';
import Badge, { badgeClasses } from '@mui/material/Badge';
import TableContainer from '@mui/material/TableContainer';
import { fCurrency } from 'src/utils/format-number';
import { useSnackbar } from 'src/components/snackbar';
import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { TableHeadCustom } from 'src/components/table';
import CustomPopover, { usePopover } from 'src/components/custom-popover';
import { Stack, Typography } from '@mui/material';
import { ConfirmDialog } from 'src/components/custom-dialog';
import axios from 'src/utils/axios';
import { useBoolean } from 'src/hooks/use-boolean';
import { useState } from 'react';
import { LoadingButton } from '@mui/lab';

// ----------------------------------------------------------------------

export default function BankingRecentTransitions({
  title,
  subheader,
  tableLabels,
  tableData,
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

            <TableBody>
              {tableData.map((row) => (
                <BankingRecentTransitionsRow
                  refreshBanks={() => refreshBanks()}
                  refreshTransactions={() => refreshTransactions()}
                  categories={categories}
                  key={row._id}
                  row={row}
                />
              ))}
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

  const categoryObject = categories[row.type].find((item) => item.category_id === row.categoryId);
  const subcategory = categoryObject.subcategories.find(
    (sub) => sub.subcategory_id === row.subCategoryId
  );
  const popover = usePopover();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleShare = () => {
    popover.onClose();
    console.info('SHARE', row.id);
  };

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

  return (
    <>
      <TableRow>
        {/* BANK ACCOUNT */}
        <TableCell sx={{  py: 0 }}>
          <ListItemText primary={row.cardName} />
        </TableCell>

        {/* DATE CELL */}
        <TableCell sx={{ py: 0 }}>
          <ListItemText
            primary={format(new Date(`${row.date} UTC`), 'dd MMM yyyy')}
          />
        </TableCell>

        {/* AMOUNT CELL */}
        <TableCell sx={{ py: 0 }}>{fCurrency(row.amount)}</TableCell>

        {/* TYPE CELL */}
        <TableCell sx={{ py: 0 }}>
          <Stack alignContent="center" alignItems="center" direction="row">
            <Badge
              overlap="circular"
              color={row.type === 'in' ? 'success' : 'error'}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              badgeContent={
                <Iconify
                  icon={
                    row.type === 'in'
                      ? 'eva:diagonal-arrow-left-down-fill'
                      : 'eva:diagonal-arrow-right-up-fill'
                  }
                  width={16}
                />
              }
              sx={{
                [`& .${badgeClasses.badge}`]: {
                  p: 0,
                  width: 20,
                },
              }}
            />
            <Typography sx={{ ml: 2 }} variant="subtitle2">
              {row.type === 'in' ? 'Income' : 'Expense'}
            </Typography>
          </Stack>
        </TableCell>

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
        title={`Delete transaction`}
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
