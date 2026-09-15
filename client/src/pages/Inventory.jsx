import {
  useEffect,
  useState
} from 'react';

import {
  useSearchParams
} from 'react-router-dom';

import {
  motion,
  useReducedMotion
} from 'framer-motion';

import {
  Search,
  X
} from 'lucide-react';

import {
  useApi
} from '../hooks/useApi';

import VehicleCard
  from '../components/VehicleCard';

import {
  fadeUp,
  stagger,
  viewport
} from '../utils/motionVariants';

export default function Inventory() {
  const [sp, setSp] = useSearchParams();

  const [query, setQuery] = useState(
    Object.fromEntries(sp)
  );

  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(
      () =>
        setSp(
          Object.fromEntries(
            Object.entries(query).filter(
              ([, v]) => v
            )
          )
        ),
      350
    );

    return () => clearTimeout(t);
  }, [query]);

  const {
    data,
    meta,
    loading,
    error
  } = useApi(
    '/vehicles',
    Object.fromEntries(sp)
  );

  const field = (
    name,
    placeholder,
    type = 'text'
  ) => (
    <input
      type={type}
      aria-label={placeholder}
      placeholder={placeholder}
      value={query[name] || ''}
      onChange={(e) =>
        setQuery({
          ...query,
          [name]: e.target.value
        })
      }
    />
  );

  return (
    <section className="page section">
      <motion.p
        className="eyebrow"
        initial={
          reduceMotion ? false : { opacity: 0, y: 16 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        THE COLLECTION
      </motion.p>

      <motion.h1
        initial={
          reduceMotion ? false : { opacity: 0, y: 24 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.08 }}
      >
        Find your next vehicle.
      </motion.h1>

      <motion.div
        className="filters"
        initial={
          reduceMotion ? false : { opacity: 0, y: 18 }
        }
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.16 }}
      >
        <label className="search">
          <Search />
          {field('search', 'Search make or model')}
        </label>

        {[
          'type',
          'make',
          'condition',
          'fuelType',
          'transmission'
        ].map((k) => (
          <select
            aria-label={k}
            key={k}
            value={query[k] || ''}
            onChange={(e) =>
              setQuery({
                ...query,
                [k]: e.target.value
              })
            }
          >
            <option value="">All {k}</option>

            {(
              {
                type: [
                  'SUV',
                  'Sedan',
                  'Hatchback',
                  'Van',
                  'Luxury'
                ],
                condition: [
                  'New',
                  'Used',
                  'Reconditioned'
                ],
                fuelType: [
                  'Petrol',
                  'Diesel',
                  'Hybrid',
                  'Electric'
                ],
                transmission: [
                  'Automatic',
                  'Manual'
                ],
                make: [
                  'Toyota',
                  'Honda',
                  'BMW',
                  'Mercedes-Benz',
                  'Suzuki',
                  'Nissan',
                  'Mazda',
                  'Kia'
                ]
              }[k] || []
            ).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        ))}

        {field('minYear', 'Min year', 'number')}
        {field('maxYear', 'Max year', 'number')}
        {field('minPrice', 'Min price', 'number')}
        {field('maxPrice', 'Max price', 'number')}

        <select
          aria-label="Sort"
          value={query.sort || 'newest'}
          onChange={(e) =>
            setQuery({
              ...query,
              sort: e.target.value
            })
          }
        >
          <option value="newest">Newest</option>
          <option value="price_asc">
            Price: low to high
          </option>
          <option value="price_desc">
            Price: high to low
          </option>
          <option value="year">Year</option>
          <option value="mileage">Mileage</option>
        </select>

        <button
          className="clear"
          onClick={() => setQuery({})}
        >
          <X />
          Clear filters
        </button>
      </motion.div>

      {loading ? (
        <div className="grid">
          {[1, 2, 3, 4, 5, 6].map((x) => (
            <div className="skeleton" key={x} />
          ))}
        </div>
      ) : error ? (
        <div className="state">{error}</div>
      ) : !data?.length ? (
        <div className="state">
          <h2>No vehicles found</h2>
          <p>Try clearing one or more filters.</p>
        </div>
      ) : (
        <>
          <p className="results">
            {meta?.total} vehicles found
          </p>

          <motion.div
            className="grid"
            key={sp.toString()}
            variants={stagger(0.06)}
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            {data.map((v) => (
              <motion.div
                key={v.vehicleId}
                variants={fadeUp}
              >
                <VehicleCard v={v} />
              </motion.div>
            ))}
          </motion.div>

          <div className="pagination">
            {Array.from(
              { length: meta?.pages || 0 },
              (_, i) => (
                <button
                  className={
                    Number(query.page || 1) === i + 1
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setQuery({
                      ...query,
                      page: i + 1
                    })
                  }
                  key={i}
                >
                  {i + 1}
                </button>
              )
            )}
          </div>
        </>
      )}
    </section>
  );
}