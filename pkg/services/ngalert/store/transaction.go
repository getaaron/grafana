package store

import (
	"context"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

type DBOperation = func(*sqlstore.DBSession) error

type UnitOfWork interface {
	Do(work func(sess *sqlstore.DBSession) error) UnitOfWork
	Execute(ctx context.Context) error
}

type DBTransaction struct {
	st   *sqlstore.SQLStore
	work DBOperation
}

func NewTransaction(st *sqlstore.SQLStore) UnitOfWork {
	return DBTransaction{
		st:   st,
		work: empty,
	}
}

func (xact DBTransaction) Do(work DBOperation) UnitOfWork {
	return DBTransaction{
		st:   xact.st,
		work: compose(xact.work, work),
	}
}

func (xact DBTransaction) Execute(ctx context.Context) error {
	return xact.st.WithTransactionalDbSession(ctx, xact.work)
}

// empty is the trivial database operation that simply no-ops. It is the identity function for compose.
func empty(*sqlstore.DBSession) error {
	return nil
}

// compose is a monad on database operations.
func compose(left, right DBOperation) DBOperation {
	return func(s *sqlstore.DBSession) error {
		err := left(s)
		if err != nil {
			return err
		}
		return right(s)
	}
}
